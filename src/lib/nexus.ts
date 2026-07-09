import "server-only";
import { getConfiguracao } from "@/lib/config";
import { prisma } from "@/lib/prisma";

// Integração de leitura com a plataforma jkcontrol.online (NEXUS.CORE).
// Só roda no servidor — a API Key nunca vai para o cliente.

export type LeituraIndicador = {
  id: string;
  nome: string;
  unidade: string | null;
  valor: number | string | null;
  timestamp: string | null;
  erro: string | null;
};

type Cfg = { nexusApiUrl: string; nexusApiKey: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
function comoArray(x: unknown): any[] {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["devices", "data", "results", "items"]) {
      if (Array.isArray(o[k])) return o[k] as any[];
    }
  }
  return [];
}

const strOf = (o: any, keys: string[]): string | undefined => {
  for (const k of keys) if (o && o[k] != null) return String(o[k]);
  return undefined;
};
const valOf = (o: any, keys: string[]): number | string | null => {
  for (const k of keys) if (o && o[k] != null) return o[k];
  return null;
};

/** Snapshot atual de todos os devices. Lança em erro de auth/rede. */
async function buscarSnapshot(cfg: Cfg): Promise<unknown> {
  const base = (cfg.nexusApiUrl || "https://jkcontrol.online").replace(/\/+$/, "");
  const resp = await fetch(`${base}/api/devices/data`, {
    headers: { Authorization: `Bearer ${cfg.nexusApiKey}` },
    next: { revalidate: 20 }, // compartilha 1 chamada por ~20s (não martela a API externa)
  });
  if (resp.status === 401 || resp.status === 403) throw new Error("Chave inválida ou sem permissão");
  if (!resp.ok) throw new Error(`Falha na API (${resp.status})`);
  return resp.json();
}

/** Extrai valor/timestamp/unidade de uma variável específica (parsing defensivo). */
function extrair(snapshot: unknown, deviceLabel: string, variableLabel: string) {
  const arr = comoArray(snapshot);

  // Formato A: array plano de leituras { deviceLabel, variableLabel, value, timestamp }
  for (const it of arr) {
    const dl = strOf(it, ["deviceLabel", "device", "label"]);
    const vl = strOf(it, ["variableLabel", "variable"]);
    if (dl === deviceLabel && vl === variableLabel) {
      return {
        valor: valOf(it, ["value", "lastValue", "currentValue", "valor"]),
        timestamp: strOf(it, ["timestamp", "lastUpdate", "updatedAt", "time"]) ?? null,
        unidade: strOf(it, ["unit", "unidade"]) ?? null,
      };
    }
  }

  // Formato B (o real do jkcontrol.online): array de devices, cada um com `variables`
  // sendo um OBJETO { [variableLabel]: { value, timestamp, time, ... } }.
  const leituraDe = (v: any) => ({
    valor:
      v != null && typeof v === "object"
        ? valOf(v, ["value", "lastValue", "currentValue", "valor"])
        : (v ?? null),
    timestamp:
      v != null && typeof v === "object"
        ? strOf(v, ["timestamp", "lastUpdate", "updatedAt", "time"]) ?? null
        : null,
    unidade: v != null && typeof v === "object" ? strOf(v, ["unit", "unidade"]) ?? null : null,
  });

  for (const dev of arr) {
    const dl = strOf(dev, ["label", "deviceLabel", "name", "_id"]);
    if (dl !== deviceLabel) continue;
    const varsRaw = dev.variables ?? dev.data ?? dev.vars;

    // Objeto (mapa por nome de variável) — formato real
    if (varsRaw && typeof varsRaw === "object" && !Array.isArray(varsRaw)) {
      const v = (varsRaw as Record<string, unknown>)[variableLabel];
      if (v != null) return leituraDe(v);
    }
    // Fallback: `variables` como array de objetos com label/name
    for (const v of comoArray(varsRaw)) {
      const vl = strOf(v, ["label", "variableLabel", "name"]);
      if (vl === variableLabel) return leituraDe(v);
    }
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Lê os indicadores ativos e busca o valor atual de cada um. Nunca lança (erros viram o campo `erro`). */
export async function buscarIndicadores(): Promise<LeituraIndicador[]> {
  const [config, indicadores] = await Promise.all([
    getConfiguracao(),
    prisma.indicadorExterno.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
  ]);
  if (indicadores.length === 0) return [];

  const base = (nome: string, unidade: string | null, erro: string | null): LeituraIndicador => ({
    id: "",
    nome,
    unidade,
    valor: null,
    timestamp: null,
    erro,
  });

  if (!config.nexusApiKey) {
    return indicadores.map((i) => ({ ...base(i.nome, i.unidade, "API não configurada"), id: i.id }));
  }

  let snapshot: unknown = null;
  let erroGlobal: string | null = null;
  try {
    snapshot = await buscarSnapshot({ nexusApiUrl: config.nexusApiUrl, nexusApiKey: config.nexusApiKey });
  } catch (e) {
    erroGlobal = e instanceof Error ? e.message : "Falha ao consultar a plataforma";
  }

  return indicadores.map((i) => {
    if (erroGlobal) return { ...base(i.nome, i.unidade, erroGlobal), id: i.id };
    const r = extrair(snapshot, i.deviceLabel, i.variableLabel);
    if (!r || r.valor == null) return { ...base(i.nome, i.unidade, "Sem leitura"), id: i.id };
    return {
      id: i.id,
      nome: i.nome,
      unidade: i.unidade ?? r.unidade,
      valor: r.valor,
      timestamp: r.timestamp,
      erro: null,
    };
  });
}

export type DeviceCatalogo = { label: string; name: string; variaveis: string[] };

/** Lista os devices e suas variáveis disponíveis na plataforma (para os menus do admin). */
export async function listarDevices(): Promise<DeviceCatalogo[]> {
  const config = await getConfiguracao();
  if (!config.nexusApiKey) return [];
  try {
    const snapshot = await buscarSnapshot({
      nexusApiUrl: config.nexusApiUrl,
      nexusApiKey: config.nexusApiKey,
    });
    return comoArray(snapshot)
      .map((dev) => {
        const label = strOf(dev, ["label", "deviceLabel", "name", "_id"]) ?? "";
        const name = strOf(dev, ["name"]) ?? label;
        const varsRaw = dev.variables ?? dev.data ?? dev.vars;
        let variaveis: string[] = [];
        if (varsRaw && typeof varsRaw === "object" && !Array.isArray(varsRaw)) {
          variaveis = Object.keys(varsRaw);
        } else {
          variaveis = comoArray(varsRaw)
            .map((v) => strOf(v, ["label", "variableLabel", "name"]) ?? "")
            .filter(Boolean);
        }
        return { label, name, variaveis };
      })
      .filter((d) => d.label);
  } catch {
    return [];
  }
}

/** Testa a conectividade/credencial (para a tela de Configurações). */
export async function testarConexaoNexus(): Promise<{ ok: boolean; mensagem: string }> {
  const config = await getConfiguracao();
  if (!config.nexusApiKey) return { ok: false, mensagem: "Sem API Key" };
  try {
    // Usa /api/devices/data (aceita API Key). O /api/users/profile só aceita token de login.
    const base = config.nexusApiUrl.replace(/\/+$/, "");
    const resp = await fetch(`${base}/api/devices/data`, {
      headers: { Authorization: `Bearer ${config.nexusApiKey}` },
      next: { revalidate: 30 },
    });
    if (resp.ok) return { ok: true, mensagem: "Conectado" };
    if (resp.status === 401 || resp.status === 403) return { ok: false, mensagem: "Chave inválida" };
    return { ok: false, mensagem: `Erro ${resp.status}` };
  } catch {
    return { ok: false, mensagem: "Sem conexão" };
  }
}

export type PontoHistorico = { t: string; v: number };

const MAX_PAGINAS_HIST = 6; // ~6.000 leituras no máximo por consulta
const ALVO_PONTOS = 240; // downsample: gráfico leve mesmo em 7 dias

/** Histórico de uma variável na janela das últimas `horas`. Nunca lança (erro → vazio).
 *  Busca paginada (página 1 = leituras mais recentes) + média por bucket de tempo. */
export async function buscarHistorico(
  deviceLabel: string,
  variableLabel: string,
  horas: number
): Promise<{ pontos: PontoHistorico[]; total: number }> {
  const config = await getConfiguracao();
  if (!config.nexusApiKey) return { pontos: [], total: 0 };

  const base = (config.nexusApiUrl || "https://jkcontrol.online").replace(/\/+$/, "");
  // Fim arredondado para 5 min: a URL fica estável e o cache do fetch (60s) é aproveitado.
  const fimMs = Math.floor(Date.now() / 300_000) * 300_000;
  const inicioMs = fimMs - horas * 3_600_000;
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 19);

  const brutos: { t: number; v: number }[] = [];
  let total = 0;
  try {
    for (let page = 1; page <= MAX_PAGINAS_HIST; page++) {
      const url =
        `${base}/api/devices/${encodeURIComponent(deviceLabel)}/variables/` +
        `${encodeURIComponent(variableLabel)}/data?page=${page}&perPage=1000` +
        `&startDate=${fmt(inicioMs)}&endDate=${fmt(fimMs)}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${config.nexusApiKey}` },
        next: { revalidate: 60 },
      });
      if (!resp.ok) break;
      const j = (await resp.json()) as {
        data?: { timestamp?: string; value?: unknown }[];
        totalItems?: number;
        totalPages?: number;
      };
      total = j.totalItems ?? total;
      for (const it of j.data ?? []) {
        const t = it.timestamp ? Date.parse(it.timestamp) : NaN;
        const v = typeof it.value === "number" ? it.value : Number(it.value);
        if (!Number.isNaN(t) && Number.isFinite(v)) brutos.push({ t, v });
      }
      if (!j.totalPages || page >= j.totalPages) break;
    }
  } catch {
    /* plataforma indisponível → devolve o que tiver (possivelmente nada) */
  }

  brutos.sort((a, b) => a.t - b.t);
  if (brutos.length <= ALVO_PONTOS) {
    return { pontos: brutos.map((p) => ({ t: new Date(p.t).toISOString(), v: p.v })), total };
  }

  // Média por bucket de tempo (mantém a forma da curva com poucos pontos)
  const primeiro = brutos[0].t;
  const ultimo = brutos[brutos.length - 1].t;
  const passo = Math.max(1, Math.ceil((ultimo - primeiro) / ALVO_PONTOS));
  const buckets = new Map<number, { soma: number; n: number }>();
  for (const p of brutos) {
    const b = Math.floor((p.t - primeiro) / passo);
    const cur = buckets.get(b) ?? { soma: 0, n: 0 };
    cur.soma += p.v;
    cur.n++;
    buckets.set(b, cur);
  }
  const pontos = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, { soma, n }]) => ({
      t: new Date(primeiro + b * passo + passo / 2).toISOString(),
      v: soma / n,
    }));
  return { pontos, total };
}
