import "server-only";
import { getConfiguracao } from "@/lib/config";
import { prisma } from "@/lib/prisma";

// Integração de leitura com a plataforma jkcontrol.online (NEXUS.CORE).
// Só roda no servidor — as API Keys nunca vão para o cliente.
// Cada chave só enxerga os devices da própria organização: além da chave principal
// (Configuracao.nexusApiKey) pode haver chaves adicionais (ConexaoNexus), e cada sensor
// guarda qual usa (conexaoId vazio = principal).

export type LeituraIndicador = {
  id: string;
  nome: string;
  unidade: string | null;
  valor: number | string | null;
  timestamp: string | null;
  erro: string | null;
};

/** O que identifica uma série na plataforma. Um IndicadorExterno do Prisma serve direto. */
export type FonteSensor = { deviceLabel: string; variableLabel: string; conexaoId?: string | null };

type Credencial = { base: string; apiKey: string };

const urlBase = (url: string | null | undefined) => (url || "https://jkcontrol.online").replace(/\/+$/, "");

/** URL + chave para ler um sensor. null = chave não configurada (ou chave adicional removida). */
async function credencialDe(conexaoId: string | null | undefined): Promise<Credencial | null> {
  const config = await getConfiguracao();
  if (!conexaoId) return config.nexusApiKey ? { base: urlBase(config.nexusApiUrl), apiKey: config.nexusApiKey } : null;
  const conexao = await prisma.conexaoNexus.findUnique({ where: { id: conexaoId }, select: { apiKey: true } });
  return conexao ? { base: urlBase(config.nexusApiUrl), apiKey: conexao.apiKey } : null;
}

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

/** Snapshot atual de todos os devices da organização da chave. Lança em erro de auth/rede. */
async function buscarSnapshot(cred: Credencial): Promise<unknown> {
  const resp = await fetch(`${cred.base}/api/devices/data`, {
    headers: { Authorization: `Bearer ${cred.apiKey}` },
    // Compartilha 1 chamada por ~20s (não martela a API externa). O cache do Next inclui os
    // headers na chave — cada API Key tem a sua entrada, sem misturar organizações.
    next: { revalidate: 20 },
    signal: AbortSignal.timeout(8_000), // plataforma travada não pode travar o app
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
  const indicadores = await prisma.indicadorExterno.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" },
  });
  if (indicadores.length === 0) return [];

  const base = (nome: string, unidade: string | null, erro: string | null): LeituraIndicador => ({
    id: "",
    nome,
    unidade,
    valor: null,
    timestamp: null,
    erro,
  });

  // Um snapshot por chave (principal + adicionais em uso), em paralelo. A falha de uma
  // chave só afeta os sensores dela.
  const conexoes = [...new Set(indicadores.map((i) => i.conexaoId ?? ""))];
  const snapshots = new Map<string, { snapshot: unknown; erro: string | null }>();
  await Promise.all(
    conexoes.map(async (c) => {
      const cred = await credencialDe(c || null);
      if (!cred) return snapshots.set(c, { snapshot: null, erro: "API não configurada" });
      try {
        snapshots.set(c, { snapshot: await buscarSnapshot(cred), erro: null });
      } catch (e) {
        snapshots.set(c, {
          snapshot: null,
          erro: e instanceof Error ? e.message : "Falha ao consultar a plataforma",
        });
      }
    })
  );

  return indicadores.map((i) => {
    const { snapshot, erro } = snapshots.get(i.conexaoId ?? "")!;
    if (erro) return { ...base(i.nome, i.unidade, erro), id: i.id };
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

/** Uma chave (principal ou adicional) com o resultado do teste e os devices que ela enxerga.
 *  Não contém a chave em si — pode ir para componentes client. */
export type ConexaoCatalogo = {
  id: string | null; // null = chave principal
  nome: string;
  ok: boolean;
  mensagem: string;
  devices: DeviceCatalogo[];
};

function devicesDoSnapshot(snapshot: unknown): DeviceCatalogo[] {
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
}

/**
 * Testa cada chave configurada e lista os devices/variáveis que ela enxerga
 * (status e menus da tela de Configurações). Usa /api/devices/data, que aceita API Key —
 * o /api/users/profile só aceita token de login. Nunca lança.
 */
export async function catalogoNexus(): Promise<ConexaoCatalogo[]> {
  const [config, adicionais] = await Promise.all([
    getConfiguracao(),
    prisma.conexaoNexus.findMany({ orderBy: { criadoEm: "asc" } }),
  ]);
  const base = urlBase(config.nexusApiUrl);
  const chaves = [
    ...(config.nexusApiKey ? [{ id: null, nome: "Principal", apiKey: config.nexusApiKey }] : []),
    ...adicionais.map((c) => ({ id: c.id as string | null, nome: c.nome, apiKey: c.apiKey })),
  ];
  return Promise.all(
    chaves.map(async ({ id, nome, apiKey }): Promise<ConexaoCatalogo> => {
      try {
        const devices = devicesDoSnapshot(await buscarSnapshot({ base, apiKey }));
        return { id, nome, ok: true, mensagem: `Conectado · ${devices.length} device(s)`, devices };
      } catch (e) {
        // buscarSnapshot lança "Chave inválida…"/"Falha na API (status)"; o resto é rede/timeout
        const m = e instanceof Error ? e.message : "";
        const mensagem = m.startsWith("Chave") ? "Chave inválida" : m.startsWith("Falha") ? m : "Sem conexão";
        return { id, nome, ok: false, mensagem, devices: [] };
      }
    })
  );
}

export type PontoHistorico = { t: string; v: number };

export type AnaliseSensor = {
  min: number;
  max: number;
  media: number;
  /** Períodos em que o valor ficou (praticamente) zerado — ex.: falta de água num sensor de pressão. */
  episodiosZero: { inicio: string; fim: string }[];
  minutosZero: number;
};

/** Resume as últimas 24h de um sensor: mín/máx/média + períodos com valor zerado.
 *  Usado para dar contexto histórico à IA. Nunca lança (sem dados → null). */
export async function analisarHistorico24h(fonte: FonteSensor): Promise<AnaliseSensor | null> {
  const { pontos } = await buscarHistorico(fonte, 24);
  if (pontos.length === 0) return null;

  const vs = pontos.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const media = vs.reduce((s, v) => s + v, 0) / vs.length;

  // "Zerado" = abaixo de 2% do máximo (mínimo 0.5) — tolera ruído do sensor e do downsample.
  const limiar = Math.max(0.5, max * 0.02);
  const episodios: { inicio: string; fim: string }[] = [];
  let atual: { inicio: string; fim: string } | null = null;
  for (const p of pontos) {
    if (p.v <= limiar) {
      if (!atual) atual = { inicio: p.t, fim: p.t };
      else atual.fim = p.t;
    } else if (atual) {
      episodios.push(atual);
      atual = null;
    }
  }
  if (atual) episodios.push(atual);

  const minutosZero = Math.round(
    episodios.reduce((s, e) => s + (Date.parse(e.fim) - Date.parse(e.inicio)) / 60_000, 0)
  );
  return { min, max, media, episodiosZero: episodios, minutosZero };
}

export type LeituraBruta = { t: number; v: number }; // t = epoch ms

/**
 * Leituras brutas de uma variável numa janela FIXA [inicioMs, fimMs), paginadas
 * (página 1 = mais recentes). Nunca lança. Distingue falha de "sem leituras":
 * - `ok: false` → a plataforma falhou (rede, chave, HTTP ≠ 200);
 * - `completo: false` → havia mais páginas que `maxPaginas` (série truncada).
 * Quem GRAVA resultado (ex.: consumo diário) só deve gravar com ok && completo.
 */
export async function buscarLeituras(
  fonte: FonteSensor,
  inicioMs: number,
  fimMs: number,
  opcoes: { maxPaginas?: number; cacheSegundos?: number } = {}
): Promise<{ leituras: LeituraBruta[]; total: number; ok: boolean; completo: boolean }> {
  const cred = await credencialDe(fonte.conexaoId);
  if (!cred) return { leituras: [], total: 0, ok: false, completo: false };

  const { deviceLabel, variableLabel } = fonte;
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 19);
  const maxPaginas = opcoes.maxPaginas ?? 6;

  const leituras: LeituraBruta[] = [];
  let total = 0;
  let completo = false;
  try {
    for (let page = 1; page <= maxPaginas; page++) {
      const url =
        `${cred.base}/api/devices/${encodeURIComponent(deviceLabel)}/variables/` +
        `${encodeURIComponent(variableLabel)}/data?page=${page}&perPage=1000` +
        `&startDate=${fmt(inicioMs)}&endDate=${fmt(fimMs)}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${cred.apiKey}` },
        ...(opcoes.cacheSegundos
          ? { next: { revalidate: opcoes.cacheSegundos } }
          : { cache: "no-store" as const }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) return { leituras, total, ok: false, completo: false };
      const j = (await resp.json()) as {
        data?: { timestamp?: string; value?: unknown }[];
        totalItems?: number;
        totalPages?: number;
      };
      total = j.totalItems ?? total;
      for (const it of j.data ?? []) {
        const t = it.timestamp ? Date.parse(it.timestamp) : NaN;
        const v = typeof it.value === "number" ? it.value : Number(it.value);
        // Filtro defensivo da janela (a API recebe as datas sem fuso explícito)
        if (!Number.isNaN(t) && Number.isFinite(v) && t >= inicioMs && t < fimMs) {
          leituras.push({ t, v });
        }
      }
      if (!j.totalPages || page >= j.totalPages) {
        completo = true;
        break;
      }
    }
  } catch {
    return { leituras, total, ok: false, completo: false };
  }
  leituras.sort((a, b) => a.t - b.t);
  return { leituras, total, ok: true, completo };
}

const MAX_PAGINAS_HIST = 6; // ~6.000 leituras no máximo por consulta
const ALVO_PONTOS = 240; // downsample: gráfico leve mesmo em 7 dias

/** Histórico de uma variável na janela das últimas `horas`. Nunca lança (erro → vazio).
 *  Busca paginada (página 1 = leituras mais recentes) + média por bucket de tempo. */
export async function buscarHistorico(
  fonte: FonteSensor,
  horas: number
): Promise<{ pontos: PontoHistorico[]; total: number }> {
  // Fim arredondado para 5 min: a URL fica estável e o cache do fetch (60s) é aproveitado.
  const fimMs = Math.floor(Date.now() / 300_000) * 300_000;
  const inicioMs = fimMs - horas * 3_600_000;
  const { leituras: brutos, total } = await buscarLeituras(fonte, inicioMs, fimMs, {
    maxPaginas: MAX_PAGINAS_HIST,
    cacheSegundos: 60,
  });
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
