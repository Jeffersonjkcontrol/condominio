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
