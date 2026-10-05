// Análises do relatório de consumo de água — funções PURAS (sem banco, sem rede), testadas em
// scripts/teste-agua-relatorio.ts. Recebem os dias já calculados (ConsumoDiario) e devolvem
// resumo, ranking, dias atípicos, padrões por dia da semana/hora e qualidade do dado.
// Usadas pela página /agua, pelo PDF/Excel e pelo contexto do Assistente IA (mesmos números).

import { COBERTURA_MINIMA, diaConfiavel, formatarVolume, somarDias } from "./agua-calc";

export type DiaRelatorio = {
  dia: string; // AAAA-MM-DD (Brasília)
  consumoLitros: number;
  consumoEstimadoLitros: number;
  porHora: number[]; // 24 posições, litros
  horaPico: number | null;
  cobertura: number;
  amostras: number;
  problema: string | null;
};

// ---------------------------------------------------------------------------
// Calendário / rótulos
// ---------------------------------------------------------------------------
const DIA_MS = 86_400_000;
const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function diaDaSemana(dia: string): number {
  return new Date(`${dia}T12:00:00Z`).getUTCDay();
}

/** "29/09/2026" ou, com semana, "ter, 29/09". */
export function rotuloDia(dia: string, comSemana = false): string {
  const [a, m, d] = dia.split("-");
  return comSemana ? `${SEMANA_CURTA[diaDaSemana(dia)]}, ${d}/${m}` : `${d}/${m}/${a}`;
}

function rotuloMes(dia: string): string {
  const [a, m] = dia.split("-");
  return `${MESES[Number(m) - 1]} de ${a}`;
}

/** Quantidade de dias de `de` a `ate`, inclusive. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS) + 1;
}

export function listarDias(de: string, ate: string): string[] {
  const r: string[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) r.push(d);
  return r;
}

const primeiroDoMes = (dia: string) => `${dia.slice(0, 7)}-01`;
const ultimoDoMes = (dia: string) => somarDias(primeiroDoMes(somarDias(primeiroDoMes(dia), 32)), -1);
const diaValido = (s?: string | null): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------
export const PRESETS_PERIODO = [
  { id: "30d", rotulo: "Últimos 30 dias" },
  { id: "90d", rotulo: "Últimos 90 dias" },
  { id: "mes", rotulo: "Mês atual" },
  { id: "mes-anterior", rotulo: "Mês anterior" },
  { id: "personalizado", rotulo: "Personalizado" },
] as const;
export type PresetPeriodo = (typeof PRESETS_PERIODO)[number]["id"];

export type Periodo = {
  preset: PresetPeriodo;
  de: string;
  ate: string;
  rotulo: string;
  /** "AAAA-MM" quando o período é o mês corrente (permite projetar o mês). */
  mesCorrente: string | null;
};

const MAX_DIAS_PERIODO = 366;

/**
 * Resolve o período pedido. `hoje` = dia de Brasília. Os dias guardados vão até ONTEM
 * (hoje ainda está em andamento), então todo período termina no máximo ontem.
 * Também aceita `mes` = "AAAA-MM" (um mês específico, ex.: pedido do Assistente).
 */
export function resolverPeriodo(
  preset: string | null | undefined,
  hoje: string,
  opts: { de?: string | null; ate?: string | null; mes?: string | null } = {}
): Periodo {
  const ontem = somarDias(hoje, -1);

  if (opts.mes && /^\d{4}-\d{2}$/.test(opts.mes)) {
    const ini = `${opts.mes}-01`;
    if (diaValido(ini) && ini <= ontem) {
      const fim = ultimoDoMes(ini) < ontem ? ultimoDoMes(ini) : ontem;
      const corrente = ini === primeiroDoMes(hoje);
      return {
        preset: "personalizado",
        de: ini,
        ate: fim,
        rotulo: corrente ? `${rotuloMes(ini)} (até ${rotuloDia(fim)})` : rotuloMes(ini),
        mesCorrente: corrente ? opts.mes : null,
      };
    }
  }

  if (preset === "personalizado" && diaValido(opts.de) && diaValido(opts.ate)) {
    let [a, b] = opts.de <= opts.ate ? [opts.de, opts.ate] : [opts.ate, opts.de];
    if (b > ontem) b = ontem;
    if (a > b) a = b;
    if (diasEntre(a, b) > MAX_DIAS_PERIODO) a = somarDias(b, -(MAX_DIAS_PERIODO - 1));
    return { preset, de: a, ate: b, rotulo: `${rotuloDia(a)} a ${rotuloDia(b)}`, mesCorrente: null };
  }

  // Mês atual — no dia 1º ele ainda não tem dia fechado, então cai no mês anterior.
  if (preset === "mes" && !hoje.endsWith("-01")) {
    const ini = primeiroDoMes(hoje);
    return {
      preset: "mes",
      de: ini,
      ate: ontem,
      rotulo: `${rotuloMes(ini)} (até ${rotuloDia(ontem)})`,
      mesCorrente: ini.slice(0, 7),
    };
  }
  if (preset === "mes" || preset === "mes-anterior") {
    const ini = primeiroDoMes(somarDias(primeiroDoMes(hoje), -1));
    return { preset: "mes-anterior", de: ini, ate: ultimoDoMes(ini), rotulo: rotuloMes(ini), mesCorrente: null };
  }

  const n = preset === "90d" ? 90 : 30;
  return {
    preset: n === 90 ? "90d" : "30d",
    de: somarDias(ontem, -(n - 1)),
    ate: ontem,
    rotulo: `últimos ${n} dias (${rotuloDia(somarDias(ontem, -(n - 1)))} a ${rotuloDia(ontem)})`,
    mesCorrente: null,
  };
}

/** Período de comparação: o mês anterior (para períodos mensais) ou os N dias imediatamente antes.
 *  `curto` é para frases ("+7% em relação a {curto}"); `rotulo` traz as datas. */
export function periodoAnterior(p: Periodo): { de: string; ate: string; rotulo: string; curto: string } {
  const mensal = p.de.endsWith("-01") && (p.mesCorrente !== null || p.ate === ultimoDoMes(p.de));
  if (mensal) {
    const ini = primeiroDoMes(somarDias(p.de, -1));
    return { de: ini, ate: ultimoDoMes(ini), rotulo: rotuloMes(ini), curto: rotuloMes(ini) };
  }
  const n = diasEntre(p.de, p.ate);
  const ate = somarDias(p.de, -1);
  const de = somarDias(ate, -(n - 1));
  return { de, ate, rotulo: `${rotuloDia(de)} a ${rotuloDia(ate)}`, curto: `${n} dias anteriores` };
}

/** "a setembro de 2026" / "aos 30 dias anteriores" (crase/contração certas na frase). */
function emRelacaoA(curto: string): string {
  return /^\d+ dias/.test(curto) ? `aos ${curto}` : `a ${curto}`;
}

// ---------------------------------------------------------------------------
// Análise
// ---------------------------------------------------------------------------
/** Dia atípico: consumo a ±30% (ou mais) da mediana dos dias confiáveis. */
export const LIMIAR_ATIPICO = 0.3;
/** Madrugada (0h–6h) acima de 35% do horário de pico merece atenção (prédio residencial costuma ficar bem abaixo). */
export const LIMIAR_MADRUGADA = 0.35;
/** Mínimo de dias confiáveis para falar em mediana/atípicos e comparar com o período anterior. */
const MIN_DIAS_ESTATISTICA = 7;
const MIN_DIAS_COMPARACAO = 3;

export type Qualidade = {
  diasPeriodo: number;
  comLeitura: number;
  confiaveis: number;
  incompletos: number;
  comDefeito: number;
  semLeitura: number;
  /** Fração do consumo (dias confiáveis) que foi estimada durante enchimentos. */
  fracaoEstimada: number | null;
  /** Cobertura média nos últimos 7 dias do período (dia sem registro conta como 0). */
  coberturaUltimos7: number;
  offlineRecente: boolean;
};

export type ResumoAgua = {
  totalConfiavelLitros: number;
  mediaDiariaLitros: number | null;
  /** Média × dias do período (completa os dias sem dado confiável). */
  estimativaPeriodoLitros: number | null;
  /** Só no mês corrente: média × dias do mês. */
  projecaoMesLitros: number | null;
  mediaAnteriorLitros: number | null;
  /** Variação da média diária contra o período anterior (0,12 = +12%). */
  variacaoMedia: number | null;
  medianaLitros: number | null;
  maiores: DiaRelatorio[];
  menores: DiaRelatorio[];
  atipicos: { dia: DiaRelatorio; variacao: number }[];
  porDiaSemana: { semana: number; mediaLitros: number | null; dias: number }[];
  /** Litros por hora, média dos dias confiáveis (24 posições). */
  perfilHora: number[];
  horaPico: number | null;
  /** Média de 0h a 5h59 (L/h). */
  madrugadaLitrosHora: number | null;
  madrugadaFracaoDoPico: number | null;
  qualidade: Qualidade;
};

function mediana(vs: number[]): number {
  const o = [...vs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

const somaConsumo = (ds: DiaRelatorio[]) => ds.reduce((s, d) => s + d.consumoLitros, 0);

export function analisarPeriodo(
  dias: DiaRelatorio[],
  periodo: { de: string; ate: string; mesCorrente: string | null },
  anteriores: DiaRelatorio[] = []
): ResumoAgua {
  const noPeriodo = dias.filter((d) => d.dia >= periodo.de && d.dia <= periodo.ate);
  const diasPeriodo = diasEntre(periodo.de, periodo.ate);
  const conf = noPeriodo.filter(diaConfiavel);

  const total = somaConsumo(conf);
  const media = conf.length ? total / conf.length : null;
  const confAnt = anteriores.filter(diaConfiavel);
  const mediaAnt = confAnt.length >= MIN_DIAS_COMPARACAO ? somaConsumo(confAnt) / confAnt.length : null;
  const diasNoMes = periodo.mesCorrente
    ? diasEntre(`${periodo.mesCorrente}-01`, ultimoDoMes(`${periodo.mesCorrente}-01`))
    : null;

  // Ranking (empate → dia mais antigo primeiro). "Menores" nunca repete um dia dos "maiores".
  const ord = [...conf].sort((a, b) => b.consumoLitros - a.consumoLitros || a.dia.localeCompare(b.dia));
  const maiores = ord.slice(0, 5);
  const menores = ord.slice(Math.max(5, ord.length - 5)).reverse();

  const med = conf.length >= MIN_DIAS_ESTATISTICA ? mediana(conf.map((d) => d.consumoLitros)) : null;
  const atipicos = med
    ? conf
        .map((d) => ({ dia: d, variacao: (d.consumoLitros - med) / med }))
        .filter((a) => Math.abs(a.variacao) >= LIMIAR_ATIPICO)
        .sort((a, b) => a.dia.dia.localeCompare(b.dia.dia))
    : [];

  const porDiaSemana = Array.from({ length: 7 }, (_, semana) => {
    const ds = conf.filter((d) => diaDaSemana(d.dia) === semana);
    return { semana, mediaLitros: ds.length ? somaConsumo(ds) / ds.length : null, dias: ds.length };
  });

  const comHoras = conf.filter((d) => d.porHora.length === 24);
  const perfilHora = Array.from({ length: 24 }, (_, h) =>
    comHoras.length ? comHoras.reduce((s, d) => s + d.porHora[h], 0) / comHoras.length : 0
  );
  const maxHora = Math.max(...perfilHora);
  const horaPico = maxHora > 0 ? perfilHora.indexOf(maxHora) : null;
  const madrugada = comHoras.length ? perfilHora.slice(0, 6).reduce((s, v) => s + v, 0) / 6 : null;

  const comLeitura = noPeriodo.filter((d) => d.amostras > 0).length;
  const ultimos = listarDias(somarDias(periodo.ate, -6) > periodo.de ? somarDias(periodo.ate, -6) : periodo.de, periodo.ate);
  const coberturaUltimos7 =
    ultimos.reduce((s, dia) => s + (noPeriodo.find((d) => d.dia === dia)?.cobertura ?? 0), 0) / ultimos.length;

  return {
    totalConfiavelLitros: total,
    mediaDiariaLitros: media,
    estimativaPeriodoLitros: media != null ? media * diasPeriodo : null,
    projecaoMesLitros: media != null && diasNoMes ? media * diasNoMes : null,
    mediaAnteriorLitros: mediaAnt,
    variacaoMedia: media != null && mediaAnt ? (media - mediaAnt) / mediaAnt : null,
    medianaLitros: med,
    maiores,
    menores,
    atipicos,
    porDiaSemana,
    perfilHora,
    horaPico,
    madrugadaLitrosHora: madrugada,
    madrugadaFracaoDoPico: madrugada != null && maxHora > 0 ? madrugada / maxHora : null,
    qualidade: {
      diasPeriodo,
      comLeitura,
      confiaveis: conf.length,
      incompletos: noPeriodo.filter((d) => d.amostras > 0 && !d.problema && d.cobertura < COBERTURA_MINIMA).length,
      comDefeito: noPeriodo.filter((d) => d.problema).length,
      semLeitura: diasPeriodo - comLeitura,
      fracaoEstimada: total > 0 ? conf.reduce((s, d) => s + d.consumoEstimadoLitros, 0) / total : null,
      coberturaUltimos7,
      offlineRecente: coberturaUltimos7 < 0.8,
    },
  };
}

// ---------------------------------------------------------------------------
// Textos (os mesmos na página, no PDF e no Assistente)
// ---------------------------------------------------------------------------
/** "+12%" / "-8%" (hífen ASCII: o texto também vai para o PDF). */
export function pct(x: number): string {
  const v = Math.round(x * 100);
  return `${v > 0 ? "+" : ""}${v}%`;
}

export const volumeDia = (l: number) => `${formatarVolume(l)}`;
/** Sempre em m³ com 1 casa — colunas de tabela ficam com a mesma unidade em todas as linhas. */
export const emM3 = (l: number) =>
  `${(l / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`;
export const vazaoHora = (l: number) => `${formatarVolume(l)}/h`;

/** Destaques em linguagem simples — o que o síndico deveria olhar primeiro. */
export function destaques(r: ResumoAgua, rotuloAnterior?: string): string[] {
  const q = r.qualidade;
  const out: string[] = [];
  if (q.confiaveis === 0) {
    out.push("Sem nenhum dia com dado confiável no período — não dá para tirar conclusões.");
    return out;
  }
  if (r.variacaoMedia != null && r.mediaAnteriorLitros != null && Math.abs(r.variacaoMedia) >= 0.05) {
    out.push(
      `Média diária ${pct(r.variacaoMedia)} em relação ${rotuloAnterior ? emRelacaoA(rotuloAnterior) : "ao período anterior"} ` +
        `(${volumeDia(r.mediaDiariaLitros!)} contra ${volumeDia(r.mediaAnteriorLitros)} por dia).`
    );
  }
  if (r.atipicos.length) {
    const lista = r.atipicos
      .slice(0, 6)
      .map((a) => `${rotuloDia(a.dia.dia, true)} (${pct(a.variacao)})`)
      .join(", ");
    out.push(
      `${r.atipicos.length} dia(s) atípico(s), longe da mediana de ${volumeDia(r.medianaLitros!)}: ${lista}` +
        `${r.atipicos.length > 6 ? "…" : ""}. Vale verificar o que aconteceu nesses dias.`
    );
  }
  if (r.madrugadaFracaoDoPico != null && r.madrugadaLitrosHora != null && r.madrugadaFracaoDoPico >= LIMIAR_MADRUGADA) {
    out.push(
      `Consumo de madrugada alto: média de ${vazaoHora(r.madrugadaLitrosHora)} entre 0h e 6h ` +
        `(${Math.round(r.madrugadaFracaoDoPico * 100)}% do horário de pico, às ${r.horaPico}h). ` +
        "Em prédio residencial costuma ficar bem abaixo disso — pode ser vazamento ou uso contínuo " +
        "(irrigação, piscina, boia com defeito)." +
        ((q.fracaoEstimada ?? 0) >= 0.3
          ? " Parte desse valor é estimada (consumo durante o enchimento da caixa); confirme com o hidrômetro."
          : "")
    );
  }
  if (q.offlineRecente) {
    out.push(
      `Sensor com falhas de leitura nos últimos 7 dias do período (só ${Math.round(q.coberturaUltimos7 * 100)}% ` +
        "das horas com dado). Confira a conexão do equipamento."
    );
  }
  if ((q.fracaoEstimada ?? 0) >= 0.4) {
    out.push(
      `${Math.round(q.fracaoEstimada! * 100)}% do consumo foi estimado (a caixa enche enquanto se consome, ` +
        "o que esconde o consumo no nível) — trate os números com margem de erro maior."
    );
  }
  if (q.comDefeito > 0) {
    out.push(`${q.comDefeito} dia(s) com defeito detectado no sensor ficaram fora das médias.`);
  }
  return out;
}
