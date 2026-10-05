// Cálculo de consumo de água a partir de leituras de sensor — funções PURAS (sem banco,
// sem rede), testadas isoladamente em scripts/teste-agua-calc.ts.

export type Leitura = { t: number; v: number }; // t = epoch ms; v = valor do sensor

export const TIPOS_INDICADOR = [
  "GENERICO",
  "PRESSAO",
  "NIVEL_RESERVATORIO",
  "CONSUMO_ACUMULADO",
] as const;
export type TipoIndicador = (typeof TIPOS_INDICADOR)[number];

export const TIPO_INDICADOR_LABEL: Record<TipoIndicador, string> = {
  GENERICO: "Genérico",
  PRESSAO: "Pressão",
  NIVEL_RESERVATORIO: "Nível de reservatório",
  CONSUMO_ACUMULADO: "Consumo acumulado (hidrômetro)",
};

/** Tipos de indicador cujo consumo diário é calculado e guardado. */
export function calculaConsumo(tipo: string): boolean {
  return tipo === "NIVEL_RESERVATORIO" || tipo === "CONSUMO_ACUMULADO";
}

// ---------------------------------------------------------------------------
// Calendário de Brasília. O Brasil não tem horário de verão desde 2019, então
// America/Sao_Paulo = UTC−3 fixo. Os dias são guardados como "AAAA-MM-DD"
// justamente para não depender do fuso do servidor (que em produção é UTC).
// ---------------------------------------------------------------------------
const OFFSET_BR_MS = 3 * 3_600_000;
const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;

export function diaBR(ms: number): string {
  return new Date(ms - OFFSET_BR_MS).toISOString().slice(0, 10);
}

export function horaBR(ms: number): number {
  return new Date(ms - OFFSET_BR_MS).getUTCHours();
}

/** Instante (ms) da meia-noite de Brasília do dia "AAAA-MM-DD". */
export function inicioDiaBR(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`) + OFFSET_BR_MS;
}

export function somarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Conversões e formatação
// ---------------------------------------------------------------------------

/** Converte a leitura para litros: "%" usa a capacidade; "m³" multiplica por 1000; senão já é litros. */
export function paraLitros(
  v: number,
  unidade: string | null | undefined,
  capacidadeLitros: number | null | undefined
): number {
  const u = (unidade ?? "").trim().toLowerCase();
  if (u === "%" && capacidadeLitros) return (v / 100) * capacidadeLitros;
  if (u === "m3" || u === "m³") return v * 1000;
  return v;
}

/** "12,3 m³" para volumes grandes; "850 L" para pequenos. */
export function formatarVolume(litros: number): string {
  if (Math.abs(litros) >= 10_000) {
    return `${(litros / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m³`;
  }
  return `${Math.round(litros).toLocaleString("pt-BR")} L`;
}

// ---------------------------------------------------------------------------
// Agregação diária
// ---------------------------------------------------------------------------

export type ResultadoDia = {
  /** Consumo total do dia = medido + estimado durante o enchimento. */
  consumoLitros: number;
  /** Parte estimada: consumo "escondido" enquanto a bomba enchia a caixa. */
  consumoEstimadoLitros: number;
  /** Subida líquida observada no nível (entrada − saída durante o enchimento). */
  reabastecidoLitros: number;
  /** Consumo por hora de Brasília (24 posições). */
  porHora: number[];
  horaPico: number | null;
  nivelMinimo: number | null;
  nivelMaximo: number | null;
  amostras: number;
  /** Fração das 24 horas do dia com pelo menos uma leitura (qualidade do dado). */
  cobertura: number;
};

export type OpcoesAgregacao = {
  /** Variação mínima (L) para contar como movimento real. Padrão: 0,2% da capacidade. */
  limiarLitros?: number;
  capacidadeLitros?: number | null;
};

/** Mediana móvel centrada — remove picos isolados (leituras espúrias do sensor). */
export function filtroMediana(vs: number[], janela = 5): number[] {
  if (vs.length < janela) return vs.slice();
  const r = Math.floor(janela / 2);
  return vs.map((_, i) => {
    const w = vs.slice(Math.max(0, i - r), Math.min(vs.length, i + r + 1)).sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)];
  });
}

/** Distribui `litros` entre as horas de Brasília proporcionalmente ao tempo de [tIni, tFim]. */
function distribuirPorHora(porHora: number[], tIni: number, tFim: number, litros: number) {
  if (litros === 0) return;
  if (tFim <= tIni) {
    porHora[horaBR(tFim)] += litros;
    return;
  }
  const dur = tFim - tIni;
  let t = tIni;
  while (t < tFim) {
    const fimDaHora = Math.min(tFim, Math.floor(t / HORA_MS) * HORA_MS + HORA_MS);
    porHora[horaBR(t)] += (litros * (fimDaHora - t)) / dur;
    t = fimDaHora;
  }
}

function vazio(amostras: number, cobertura: number): ResultadoDia {
  return {
    consumoLitros: 0,
    consumoEstimadoLitros: 0,
    reabastecidoLitros: 0,
    porHora: Array(24).fill(0),
    horaPico: null,
    nivelMinimo: null,
    nivelMaximo: null,
    amostras,
    cobertura,
  };
}

function coberturaDe(leituras: Leitura[]): number {
  return new Set(leituras.map((l) => horaBR(l.t))).size / 24;
}

function finalizar(r: ResultadoDia): ResultadoDia {
  const max = Math.max(...r.porHora);
  r.horaPico = max > 0 ? r.porHora.indexOf(max) : null;
  return r;
}

type Movimento = { tIni: number; tFim: number; litros: number };

const JANELA_TAXA_MS = 60 * 60_000; // olha 1h antes/depois do enchimento para estimar a vazão de saída
const EMENDA_ENCHIMENTO_MS = 15 * 60_000; // subidas separadas por até 15 min = mesmo enchimento

/**
 * Nível de reservatório (leituras já em litros): consumo = quedas do nível; subidas = enchimento.
 * Durante o enchimento a saída continua mas fica mascarada pela entrada — ela é estimada pela
 * vazão de saída observada na hora anterior/seguinte ao enchimento.
 */
function agregarNivel(leituras: Leitura[], opts: OpcoesAgregacao): ResultadoDia {
  const ts = leituras.map((l) => l.t);
  const vs = filtroMediana(leituras.map((l) => l.v));
  const r = vazio(leituras.length, coberturaDe(leituras));
  r.nivelMinimo = Math.min(...vs);
  r.nivelMaximo = Math.max(...vs);
  if (leituras.length < 2) return r;

  const base = opts.capacidadeLitros || r.nivelMaximo || 0;
  const limiar = opts.limiarLitros ?? Math.max(1, base * 0.002);

  // Histerese: só conta o movimento quando ele passa do limiar em relação à última âncora.
  const quedas: Movimento[] = [];
  const subidas: Movimento[] = [];
  let ancora = vs[0];
  let tAncora = ts[0];
  for (let i = 1; i < vs.length; i++) {
    const d = vs[i] - ancora;
    if (d <= -limiar) quedas.push({ tIni: tAncora, tFim: ts[i], litros: -d });
    else if (d >= limiar) subidas.push({ tIni: tAncora, tFim: ts[i], litros: d });
    else continue;
    ancora = vs[i];
    tAncora = ts[i];
  }

  for (const q of quedas) {
    r.consumoLitros += q.litros;
    distribuirPorHora(r.porHora, q.tIni, q.tFim, q.litros);
  }
  r.reabastecidoLitros = subidas.reduce((s, m) => s + m.litros, 0);

  // Agrupa subidas próximas em "enchimentos" e estima o consumo mascarado em cada um.
  const enchimentos: { tIni: number; tFim: number }[] = [];
  for (const s of subidas) {
    const ult = enchimentos[enchimentos.length - 1];
    if (ult && s.tIni - ult.tFim <= EMENDA_ENCHIMENTO_MS) ult.tFim = s.tFim;
    else enchimentos.push({ tIni: s.tIni, tFim: s.tFim });
  }

  const temLeitura = (ini: number, fim: number) => ts.some((t) => t >= ini && t < fim);
  const quedaEm = (ini: number, fim: number) =>
    quedas.filter((q) => q.tFim > ini && q.tFim <= fim).reduce((s, q) => s + q.litros, 0);

  for (const e of enchimentos) {
    const taxas: number[] = []; // L/ms
    if (temLeitura(e.tIni - JANELA_TAXA_MS, e.tIni)) {
      taxas.push(quedaEm(e.tIni - JANELA_TAXA_MS, e.tIni) / JANELA_TAXA_MS);
    }
    if (temLeitura(e.tFim, e.tFim + JANELA_TAXA_MS)) {
      taxas.push(quedaEm(e.tFim, e.tFim + JANELA_TAXA_MS) / JANELA_TAXA_MS);
    }
    if (taxas.length === 0) continue;
    const taxa = taxas.reduce((s, x) => s + x, 0) / taxas.length;
    const estimado = taxa * (e.tFim - e.tIni);
    r.consumoEstimadoLitros += estimado;
    r.consumoLitros += estimado;
    distribuirPorHora(r.porHora, e.tIni, e.tFim, estimado);
  }

  return finalizar(r);
}

/** Hidrômetro com contador acumulado (litros): consumo = soma dos incrementos; queda = reset do contador. */
function agregarAcumulado(leituras: Leitura[]): ResultadoDia {
  const r = vazio(leituras.length, coberturaDe(leituras));
  for (let i = 1; i < leituras.length; i++) {
    const d = leituras[i].v - leituras[i - 1].v;
    if (d <= 0) continue; // d < 0 = contador reiniciou; não é consumo negativo
    r.consumoLitros += d;
    distribuirPorHora(r.porHora, leituras[i - 1].t, leituras[i].t, d);
  }
  return finalizar(r);
}

/**
 * Agrega as leituras de UM dia (já convertidas para litros) no resumo diário.
 * Leituras fora de ordem são aceitas (são ordenadas aqui).
 */
export function agregarDia(
  leituras: Leitura[],
  tipo: string,
  opts: OpcoesAgregacao = {}
): ResultadoDia {
  const ord = leituras
    .filter((l) => Number.isFinite(l.t) && Number.isFinite(l.v))
    .sort((a, b) => a.t - b.t);
  if (ord.length === 0) return vazio(0, 0);
  if (tipo === "CONSUMO_ACUMULADO") return agregarAcumulado(ord);
  return agregarNivel(ord, opts);
}
