import "server-only";
import ExcelJS from "exceljs";
import { getConfiguracao } from "@/lib/config";
import { consumoPeriodo, eventosPorDia, sensoresDeConsumo, type DiaConsumo } from "@/lib/agua";
import {
  diaBR,
  diaConfiavel,
  formatarVolume,
  somarDias as somarDiasBR,
  COBERTURA_MINIMA,
} from "@/lib/agua-calc";
import {
  analisarPeriodo,
  destaques,
  listarDias,
  pct,
  periodoAnterior,
  resolverPeriodo,
  rotuloDia,
  SEMANA_LONGA,
  vazaoHora,
  emM3,
  type Periodo,
  type ResumoAgua,
} from "@/lib/agua-relatorio";
import { novoDoc, secao, paragrafo, kpis, tabela, graficoBarras, finalizar } from "@/lib/pdf-report";

// Relatório de consumo de água: os mesmos números na página /agua, no PDF, no Excel e no Assistente.

export type RelatorioAgua = {
  sensor: { id: string; nome: string; capacidadeLitros: number | null; leiturasDesde: string | null };
  sensores: { id: string; nome: string }[];
  periodo: Periodo;
  anterior: { de: string; ate: string; rotulo: string; curto: string };
  dias: DiaConsumo[];
  eventos: Map<string, string[]>;
  resumo: ResumoAgua;
  destaques: string[];
};

/** Monta o relatório. null = nenhum sensor de consumo cadastrado. */
export async function montarRelatorioAgua(params: {
  sensorId?: string | null;
  periodo?: string | null;
  de?: string | null;
  ate?: string | null;
  mes?: string | null;
}): Promise<RelatorioAgua | null> {
  const sensores = await sensoresDeConsumo();
  if (sensores.length === 0) return null;
  const sensor = sensores.find((s) => s.id === params.sensorId) ?? sensores[0];

  const periodo = resolverPeriodo(params.periodo, diaBR(Date.now()), {
    de: params.de,
    ate: params.ate,
    mes: params.mes,
  });
  const anterior = periodoAnterior(periodo);
  const [dias, anteriores, eventos] = await Promise.all([
    consumoPeriodo(sensor.id, periodo.de, periodo.ate),
    consumoPeriodo(sensor.id, anterior.de, anterior.ate),
    eventosPorDia(periodo.de, periodo.ate),
  ]);
  const resumo = analisarPeriodo(dias, periodo, anteriores);
  return {
    sensor: { id: sensor.id, nome: sensor.nome, capacidadeLitros: sensor.capacidadeLitros, leiturasDesde: sensor.leiturasDesde },
    sensores: sensores.map((s) => ({ id: s.id, nome: s.nome })),
    periodo,
    anterior,
    dias,
    eventos,
    resumo,
    destaques: destaques(resumo, anterior.curto),
  };
}

const DIAS_DIARIO_IA = 62; // ~2 meses dia a dia no contexto da IA (responde "quanto gastou no dia X")

/**
 * Resumo do consumo de água para o contexto do Assistente IA — mesmos números da página/PDF.
 * "" quando não há sensor de consumo.
 */
export async function resumoAguaParaIA(): Promise<string> {
  const sensores = await sensoresDeConsumo();
  if (sensores.length === 0) return "";
  const v = (l: number | null | undefined) => (l == null ? "-" : formatarVolume(l));
  const blocos = await Promise.all(
    sensores.map(async (sensor) => {
      const [r30, mes, ant] = await Promise.all([
        montarRelatorioAgua({ sensorId: sensor.id, periodo: "30d" }),
        montarRelatorioAgua({ sensorId: sensor.id, periodo: "mes" }),
        montarRelatorioAgua({ sensorId: sensor.id, periodo: "mes-anterior" }),
      ]);
      if (!r30 || !mes || !ant) return "";
      const s = r30.resumo;
      const linhas = [
        `- ${sensor.nome}${sensor.leiturasDesde ? ` (leituras válidas desde ${rotuloDia(sensor.leiturasDesde)})` : ""}:`,
        `  · ${r30.periodo.rotulo}: total medido ${v(s.totalConfiavelLitros)} em ${s.qualidade.confiaveis} dia(s) confiáveis; ` +
          `média ${v(s.mediaDiariaLitros)}/dia` +
          (s.variacaoMedia != null ? ` (${pct(s.variacaoMedia)} vs ${r30.anterior.curto}, ${r30.anterior.rotulo})` : "") +
          (s.maiores[0] ? `; maior ${rotuloDia(s.maiores[0].dia, true)} = ${v(s.maiores[0].consumoLitros)}` : "") +
          (s.menores[0] ? `; menor ${rotuloDia(s.menores[0].dia, true)} = ${v(s.menores[0].consumoLitros)}` : ""),
        `  · Mês atual — ${mes.periodo.rotulo}: média ${v(mes.resumo.mediaDiariaLitros)}/dia` +
          (mes.resumo.projecaoMesLitros != null ? `, projeção do mês ${v(mes.resumo.projecaoMesLitros)}` : "") +
          ` | ${ant.periodo.rotulo}: total medido ${v(ant.resumo.totalConfiavelLitros)} em ` +
          `${ant.resumo.qualidade.confiaveis} dia(s) confiáveis, média ${v(ant.resumo.mediaDiariaLitros)}/dia`,
        `  · Média por dia da semana (30 dias): ` +
          s.porDiaSemana.map((x) => `${SEMANA_LONGA[x.semana]} ${v(x.mediaLitros)}`).join(", "),
        s.horaPico != null
          ? `  · Perfil por hora: pico às ${s.horaPico}h (${vazaoHora(s.perfilHora[s.horaPico])}); madrugada 0h–6h ` +
            `${vazaoHora(s.madrugadaLitrosHora ?? 0)} (${Math.round((s.madrugadaFracaoDoPico ?? 0) * 100)}% do pico)`
          : "",
        `  · Qualidade (30 dias): ${s.qualidade.confiaveis} confiáveis, ${s.qualidade.incompletos} incompletos, ` +
          `${s.qualidade.comDefeito} com defeito, ${s.qualidade.semLeitura} sem leitura; parte estimada ` +
          `${s.qualidade.fracaoEstimada != null ? Math.round(s.qualidade.fracaoEstimada * 100) : 0}%; ` +
          `cobertura nos últimos 7 dias ${Math.round(s.qualidade.coberturaUltimos7 * 100)}%`,
        ...r30.destaques.map((t) => `  · DESTAQUE: ${t}`),
      ];
      const diario = await consumoPeriodo(
        sensor.id,
        somarDiasBR(r30.periodo.ate, -(DIAS_DIARIO_IA - 1)),
        r30.periodo.ate
      );
      linhas.push(
        `  · Dia a dia (${diario.length} dias; * = fora das médias): ` +
          diario
            .filter((d) => d.amostras > 0)
            .map((d) => `${rotuloDia(d.dia, true)} ${v(d.consumoLitros)}${diaConfiavel(d) ? "" : "*"}`)
            .join("; ")
      );
      return linhas.filter(Boolean).join("\n");
    })
  );
  return blocos.filter(Boolean).join("\n");
}

const DEFEITO_CURTO: Record<string, string> = {
  SALTOS: "saltos impossíveis nas leituras",
  TRAVADO: "nível parado o dia todo",
};

/** Situação do dia em texto curto (tabelas do PDF/Excel). */
export function situacaoDia(d: DiaConsumo | undefined): string {
  if (!d || d.amostras === 0) return "sem leitura";
  if (d.problema) return `defeito: ${DEFEITO_CURTO[d.problema] ?? d.problema}`;
  if (d.cobertura < COBERTURA_MINIMA) return `incompleto (${Math.round(d.cobertura * 100)}% do dia)`;
  return "ok";
}

const nomeArquivoSeguro = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 40) || "sensor";

export function nomeArquivoAgua(r: RelatorioAgua, ext: "pdf" | "xlsx"): string {
  return `consumo-agua-${nomeArquivoSeguro(r.sensor.nome)}-${r.periodo.de}_a_${r.periodo.ate}.${ext}`;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
export async function gerarPdfAgua(r: RelatorioAgua): Promise<Uint8Array> {
  const { nomeCondominio } = await getConfiguracao();
  const s = r.resumo;
  const q = s.qualidade;
  const v = (l: number | null) => (l == null ? "-" : formatarVolume(l));

  const d = await novoDoc(
    `${nomeCondominio} — Consumo de Água`,
    `${r.sensor.nome} · ${r.periodo.rotulo} · Emitido em ${rotuloDia(diaBR(Date.now()))}`
  );

  kpis(d, [
    { label: `Total medido (${q.confiaveis} dias confiáveis)`, valor: v(s.totalConfiavelLitros) },
    { label: "Média diária", valor: v(s.mediaDiariaLitros) },
    {
      label: `vs ${r.anterior.curto}`,
      valor: s.variacaoMedia != null ? pct(s.variacaoMedia) : "sem base",
    },
    s.projecaoMesLitros != null
      ? { label: "Projeção do mês", valor: v(s.projecaoMesLitros) }
      : { label: `Estimativa (${q.diasPeriodo} dias)`, valor: v(s.estimativaPeriodoLitros) },
    {
      label: s.maiores[0] ? `Maior: ${rotuloDia(s.maiores[0].dia, true)}` : "Maior consumo",
      valor: s.maiores[0] ? v(s.maiores[0].consumoLitros) : "-",
    },
    { label: "Dias confiáveis", valor: `${q.confiaveis} de ${q.diasPeriodo}` },
  ]);

  secao(d, "Destaques");
  if (r.destaques.length === 0) paragrafo(d, "Nada fora do normal no período.");
  for (const t of r.destaques) paragrafo(d, `• ${t}`);

  const porDia = new Map(r.dias.map((x) => [x.dia, x]));
  const todos = listarDias(r.periodo.de, r.periodo.ate);
  secao(d, "Consumo por dia");
  graficoBarras(
    d,
    todos.map((dia) => {
      const x = porDia.get(dia);
      return { rotulo: dia.slice(8) + "/" + dia.slice(5, 7), valor: x?.consumoLitros ?? 0, fraca: !x || !diaConfiavel(x) };
    }),
    { formatarEixo: (l) => formatarVolume(l) }
  );
  paragrafo(d, "Barras claras: dia fora das médias (dado incompleto ou defeito do sensor).", 8);

  const linhaRanking = (x: { dia: string; consumoLitros: number }) => [
    rotuloDia(x.dia, true),
    emM3(x.consumoLitros),
    s.medianaLitros ? pct((x.consumoLitros - s.medianaLitros) / s.medianaLitros) : "-",
    (r.eventos.get(x.dia) ?? []).join(", ") || "-",
  ];
  const colRanking = [
    { titulo: "Dia", largura: 80 },
    { titulo: "Consumo", largura: 80, alinhar: "direita" as const },
    { titulo: "vs mediana", largura: 70, alinhar: "direita" as const },
    { titulo: "Eventos no dia", largura: 285 },
  ];
  secao(d, "Maiores consumos");
  if (s.maiores.length) tabela(d, colRanking, s.maiores.map(linhaRanking));
  else paragrafo(d, "Sem dias confiáveis no período.");
  if (s.menores.length) {
    secao(d, "Menores consumos");
    tabela(d, colRanking, s.menores.map(linhaRanking));
  }
  if (s.atipicos.length) {
    secao(d, `Dias atípicos (±30% da mediana de ${v(s.medianaLitros)})`);
    tabela(d, colRanking, s.atipicos.map((a) => linhaRanking(a.dia)));
  }

  secao(d, "Média por dia da semana");
  tabela(
    d,
    [
      { titulo: "Dia da semana", largura: 200 },
      { titulo: "Média", largura: 120, alinhar: "direita" },
      { titulo: "Dias considerados", largura: 195, alinhar: "direita" },
    ],
    s.porDiaSemana.map((x) => [SEMANA_LONGA[x.semana], v(x.mediaLitros), String(x.dias)])
  );

  secao(d, "Perfil por hora (média dos dias confiáveis)");
  graficoBarras(
    d,
    s.perfilHora.map((l, h) => ({ rotulo: `${h}h`, valor: l })),
    { formatarEixo: (l) => vazaoHora(l), rotuloACada: 2, altura: 110 }
  );
  if (s.horaPico != null && s.madrugadaLitrosHora != null) {
    paragrafo(
      d,
      `Pico às ${s.horaPico}h (${vazaoHora(s.perfilHora[s.horaPico])}). Madrugada (0h–6h): média de ` +
        `${vazaoHora(s.madrugadaLitrosHora)}, ${Math.round((s.madrugadaFracaoDoPico ?? 0) * 100)}% do pico.`,
      9
    );
  }

  secao(d, "Qualidade do dado");
  tabela(
    d,
    [
      { titulo: "Indicador", largura: 330 },
      { titulo: "Valor", largura: 185, alinhar: "direita" },
    ],
    [
      ["Dias no período", String(q.diasPeriodo)],
      ["Dias confiáveis (entram nas médias)", String(q.confiaveis)],
      ["Dias incompletos (sensor sem leitura em mais da metade do dia)", String(q.incompletos)],
      ["Dias com defeito detectado no sensor", String(q.comDefeito)],
      ["Dias sem nenhuma leitura", String(q.semLeitura)],
      ["Parte do consumo estimada (durante enchimentos)", q.fracaoEstimada != null ? `${Math.round(q.fracaoEstimada * 100)}%` : "-"],
      ["Cobertura nos últimos 7 dias do período", `${Math.round(q.coberturaUltimos7 * 100)}%`],
    ]
  );

  secao(d, "Consumo diário");
  tabela(
    d,
    [
      { titulo: "Dia", largura: 80 },
      { titulo: "Consumo", largura: 75, alinhar: "direita" },
      { titulo: "Estimado", largura: 70, alinhar: "direita" },
      { titulo: "Pico", largura: 40, alinhar: "direita" },
      { titulo: "Situação", largura: 250 },
    ],
    todos.map((dia) => {
      const x = porDia.get(dia);
      return [
        rotuloDia(dia, true),
        x && x.amostras > 0 ? emM3(x.consumoLitros) : "-",
        x && x.amostras > 0 ? emM3(x.consumoEstimadoLitros) : "-",
        x?.horaPico != null ? `${x.horaPico}h` : "-",
        situacaoDia(x),
      ];
    })
  );

  secao(d, "Como o consumo é calculado");
  paragrafo(
    d,
    "O consumo vem do sensor de nível do reservatório: quedas do nível são consumo; subidas são " +
      "enchimento. Enquanto a caixa enche, o consumo continua mas fica escondido no sinal — essa parte é " +
      "estimada pela vazão de saída antes e depois do enchimento. Dias com menos da metade das horas com " +
      "leitura, ou com defeito detectado no sensor (saltos impossíveis ou nível parado o dia todo), ficam " +
      "fora das médias. Dias atípicos: consumo 30% ou mais acima/abaixo da mediana do período." +
      (r.sensor.leiturasDesde ? ` Leituras consideradas a partir de ${rotuloDia(r.sensor.leiturasDesde)}.` : ""),
    9
  );

  return finalizar(d);
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------
export async function gerarXlsxAgua(r: RelatorioAgua): Promise<Buffer> {
  const { nomeCondominio } = await getConfiguracao();
  const s = r.resumo;
  const q = s.qualidade;
  const m3 = (l: number | null | undefined) => (l == null ? null : Math.round(l) / 1000);
  const wb = new ExcelJS.Workbook();
  const cabecalho = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  // Resumo
  const res = wb.addWorksheet("Resumo");
  res.columns = [
    { header: "Item", key: "item", width: 46 },
    { header: "Valor", key: "valor", width: 34 },
  ];
  cabecalho(res);
  const linhas: [string, string | number | null][] = [
    ["Condomínio", nomeCondominio],
    ["Sensor", r.sensor.nome],
    ["Período", r.periodo.rotulo],
    ["De", rotuloDia(r.periodo.de)],
    ["Até", rotuloDia(r.periodo.ate)],
    ["Emitido em", rotuloDia(diaBR(Date.now()))],
    ["Total medido nos dias confiáveis (m³)", m3(s.totalConfiavelLitros)],
    ["Média diária (m³)", m3(s.mediaDiariaLitros)],
    [`Estimativa do período — média × ${q.diasPeriodo} dias (m³)`, m3(s.estimativaPeriodoLitros)],
    ["Projeção do mês (m³)", m3(s.projecaoMesLitros)],
    [`Média diária em ${r.anterior.rotulo} (m³)`, m3(s.mediaAnteriorLitros)],
    ["Variação da média diária", s.variacaoMedia != null ? pct(s.variacaoMedia) : "sem base"],
    ["Mediana diária (m³)", m3(s.medianaLitros)],
    ["Dias no período", q.diasPeriodo],
    ["Dias confiáveis", q.confiaveis],
    ["Dias incompletos", q.incompletos],
    ["Dias com defeito do sensor", q.comDefeito],
    ["Dias sem leitura", q.semLeitura],
    ["Parte estimada do consumo", q.fracaoEstimada != null ? `${Math.round(q.fracaoEstimada * 100)}%` : "-"],
    ["Cobertura nos últimos 7 dias", `${Math.round(q.coberturaUltimos7 * 100)}%`],
  ];
  for (const [item, valor] of linhas) {
    const row = res.addRow({ item, valor });
    if (item.includes("(m³)")) row.getCell("valor").numFmt = "#,##0.0";
  }
  res.addRow({});
  res.addRow({ item: "Destaques" }).font = { bold: true };
  if (r.destaques.length === 0) res.addRow({ item: "Nada fora do normal no período." });
  for (const t of r.destaques) res.addRow({ item: t }).alignment = { wrapText: true };

  // Diário
  const porDia = new Map(r.dias.map((x) => [x.dia, x]));
  const di = wb.addWorksheet("Diário");
  di.columns = [
    { header: "Dia", key: "dia", width: 12 },
    { header: "Dia da semana", key: "semana", width: 14 },
    { header: "Consumo (m³)", key: "consumo", width: 14, style: { numFmt: "#,##0.0" } },
    { header: "Estimado no enchimento (m³)", key: "estimado", width: 26, style: { numFmt: "#,##0.0" } },
    { header: "Cobertura", key: "cobertura", width: 11, style: { numFmt: "0%" } },
    { header: "Entra nas médias", key: "confiavel", width: 16 },
    { header: "Situação", key: "situacao", width: 44 },
    { header: "Hora de pico", key: "pico", width: 12 },
    { header: "Eventos", key: "eventos", width: 40 },
  ];
  cabecalho(di);
  for (const dia of listarDias(r.periodo.de, r.periodo.ate)) {
    const x = porDia.get(dia);
    const tem = !!x && x.amostras > 0;
    di.addRow({
      dia: new Date(`${dia}T12:00:00Z`),
      semana: SEMANA_LONGA[new Date(`${dia}T12:00:00Z`).getUTCDay()],
      consumo: tem ? m3(x!.consumoLitros) : null,
      estimado: tem ? m3(x!.consumoEstimadoLitros) : null,
      cobertura: x ? x.cobertura : 0,
      confiavel: x && diaConfiavel(x) ? "sim" : "não",
      situacao: situacaoDia(x),
      pico: x?.horaPico != null ? `${x.horaPico}h` : "",
      eventos: (r.eventos.get(dia) ?? []).join(", "),
    });
  }
  di.getColumn("dia").numFmt = "dd/mm/yyyy";

  // Por hora (litros) — permite montar mapa de calor/filtros na própria planilha
  const ph = wb.addWorksheet("Por hora (litros)");
  ph.columns = [
    { header: "Dia", key: "dia", width: 12 },
    ...Array.from({ length: 24 }, (_, h) => ({ header: `${h}h`, key: `h${h}`, width: 8, style: { numFmt: "#,##0" } })),
  ];
  cabecalho(ph);
  for (const x of r.dias.filter((x) => x.amostras > 0)) {
    const row: Record<string, unknown> = { dia: new Date(`${x.dia}T12:00:00Z`) };
    x.porHora.forEach((l, h) => (row[`h${h}`] = Math.round(l)));
    ph.addRow(row);
  }
  ph.getColumn("dia").numFmt = "dd/mm/yyyy";

  // Padrões
  const pa = wb.addWorksheet("Padrões");
  pa.columns = [
    { header: "Dia da semana", key: "a", width: 16 },
    { header: "Média (m³)", key: "b", width: 12, style: { numFmt: "#,##0.0" } },
    { header: "Dias", key: "c", width: 8 },
    { header: "", key: "sep", width: 4 },
    { header: "Hora", key: "h", width: 8 },
    { header: "Média (litros/h)", key: "lh", width: 16, style: { numFmt: "#,##0" } },
  ];
  cabecalho(pa);
  for (let i = 0; i < 24; i++) {
    const sem = s.porDiaSemana[i];
    pa.addRow({
      a: sem ? SEMANA_LONGA[sem.semana] : undefined,
      b: sem ? m3(sem.mediaLitros) : undefined,
      c: sem ? sem.dias : undefined,
      h: `${i}h`,
      lh: Math.round(s.perfilHora[i]),
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
