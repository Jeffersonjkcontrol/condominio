// Geração dos relatórios estruturados em PDF. Uso exclusivo no servidor.

import { prisma } from "@/lib/prisma";
import { getConfiguracao } from "@/lib/config";
import { formatarMoeda, formatarData } from "@/lib/utils";
import {
  etapaAtrasada,
  diasAtraso,
  statusCalculadoObra,
  STATUS_OBRA_LABEL,
} from "@/lib/obras";
import {
  statusCalculadoOS,
  progressoOS,
  STATUS_OS_LABEL,
} from "@/lib/manutencao";
import { ACAO_LABEL } from "@/lib/auditoria";
import { formatarDataHora } from "@/lib/utils";
import {
  novoDoc,
  secao,
  paragrafo,
  kpis,
  tabela,
  totalLinha,
  finalizar,
} from "@/lib/pdf-report";

export type TipoRelatorio =
  | "financeiro"
  | "obras"
  | "fornecedores"
  | "geral"
  | "manutencao"
  | "auditoria";

export const TIPOS_RELATORIO: { tipo: TipoRelatorio; nome: string; descricao: string }[] = [
  { tipo: "financeiro", nome: "Financeiro mensal", descricao: "Recibos, total, gastos por categoria e fornecedor." },
  { tipo: "obras", nome: "Obras e atrasos", descricao: "Obras, etapas, progresso e dias de atraso." },
  { tipo: "manutencao", nome: "Manutenção (OS)", descricao: "Ordens de serviço, tipo, status, prazos e custos." },
  { tipo: "fornecedores", nome: "Fornecedores e serviços", descricao: "Fornecedores, contatos e serviços prestados." },
  { tipo: "auditoria", nome: "Auditoria (rastreabilidade)", descricao: "Quem fez o quê e quando no sistema." },
  { tipo: "geral", nome: "Prestação de contas (geral)", descricao: "Visão consolidada: KPIs, financeiro e obras." },
];

function nomeMes(mesReferencia?: string): { inicio?: Date; fim?: Date; rotulo: string } {
  if (!mesReferencia || !/^\d{4}-\d{2}$/.test(mesReferencia)) {
    return { rotulo: "Todos os períodos" };
  }
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);
  const rotulo = inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { inicio, fim, rotulo };
}

export async function gerarRelatorio(
  tipo: TipoRelatorio,
  opts: { mesReferencia?: string } = {}
): Promise<{ bytes: Uint8Array; nomeArquivo: string; titulo: string }> {
  const config = await getConfiguracao();
  const nome = config.nomeCondominio;
  const hoje = new Date();

  if (tipo === "financeiro") return relatorioFinanceiro(nome, opts.mesReferencia, hoje);
  if (tipo === "obras") return relatorioObras(nome, hoje);
  if (tipo === "fornecedores") return relatorioFornecedores(nome);
  if (tipo === "manutencao") return relatorioManutencao(nome, hoje);
  if (tipo === "auditoria") return relatorioAuditoria(nome, opts.mesReferencia, hoje);
  return relatorioGeral(nome, hoje);
}

async function relatorioFinanceiro(nome: string, mesReferencia: string | undefined, hoje: Date) {
  const { inicio, fim, rotulo } = nomeMes(mesReferencia);
  const recibos = await prisma.recibo.findMany({
    where: inicio && fim ? { dataEmissao: { gte: inicio, lt: fim } } : {},
    orderBy: { dataEmissao: "desc" },
    include: { fornecedor: { select: { nome: true } } },
  });

  const total = recibos.reduce((s, r) => s + r.valor, 0);
  const pendentes = recibos.filter((r) => r.status === "PENDENTE").length;

  const d = await novoDoc(
    `${nome} — Relatório Financeiro`,
    `Período: ${rotulo} · Emitido em ${formatarData(hoje)}`
  );

  kpis(d, [
    { label: "Total no período", valor: formatarMoeda(total) },
    { label: "Recibos", valor: String(recibos.length) },
    { label: "Pendentes", valor: String(pendentes) },
  ]);

  const porCategoria = new Map<string, number>();
  recibos.forEach((r) => porCategoria.set(r.categoria, (porCategoria.get(r.categoria) ?? 0) + r.valor));
  secao(d, "Gastos por categoria");
  tabela(
    d,
    [
      { titulo: "Categoria", largura: 360 },
      { titulo: "Valor", largura: 155, alinhar: "direita" },
    ],
    [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, formatarMoeda(v)])
  );

  const porFornecedor = new Map<string, number>();
  recibos.forEach((r) => {
    const f = r.fornecedor?.nome ?? "Sem fornecedor";
    porFornecedor.set(f, (porFornecedor.get(f) ?? 0) + r.valor);
  });
  secao(d, "Gastos por fornecedor");
  tabela(
    d,
    [
      { titulo: "Fornecedor", largura: 360 },
      { titulo: "Valor", largura: 155, alinhar: "direita" },
    ],
    [...porFornecedor.entries()].sort((a, b) => b[1] - a[1]).map(([f, v]) => [f, formatarMoeda(v)])
  );

  secao(d, "Recibos do período");
  if (recibos.length === 0) {
    paragrafo(d, "Nenhum recibo no período selecionado.");
  } else {
    tabela(
      d,
      [
        { titulo: "Data", largura: 70 },
        { titulo: "Categoria", largura: 110 },
        { titulo: "Fornecedor", largura: 180 },
        { titulo: "Status", largura: 75 },
        { titulo: "Valor", largura: 80, alinhar: "direita" },
      ],
      recibos.map((r) => [
        formatarData(r.dataEmissao),
        r.categoria,
        r.fornecedor?.nome ?? "—",
        r.status === "CONFERIDO" ? "Conferido" : "Pendente",
        formatarMoeda(r.valor),
      ])
    );
    totalLinha(d, "TOTAL", formatarMoeda(total));
  }

  const bytes = await finalizar(d);
  return { bytes, nomeArquivo: `relatorio-financeiro.pdf`, titulo: "Relatório Financeiro" };
}

async function relatorioObras(nome: string, hoje: Date) {
  const obras = await prisma.obra.findMany({
    orderBy: { dataInicioPrev: "desc" },
    include: {
      etapas: { orderBy: { ordem: "asc" } },
      responsavel: { select: { nome: true } },
      recibos: { select: { valor: true } },
    },
  });

  const ativas = obras.filter((o) => statusCalculadoObra(o.status, o.dataInicioPrev, o.dataFimPrev, o.etapas, hoje) !== "CONCLUIDA").length;
  const etapasAtrasadas = obras.flatMap((o) => o.etapas.filter((e) => etapaAtrasada(e, hoje))).length;

  const d = await novoDoc(`${nome} — Relatório de Obras`, `Emitido em ${formatarData(hoje)}`);

  kpis(d, [
    { label: "Obras", valor: String(obras.length) },
    { label: "Ativas", valor: String(ativas) },
    { label: "Etapas atrasadas", valor: String(etapasAtrasadas) },
  ]);

  if (obras.length === 0) paragrafo(d, "Nenhuma obra cadastrada.");

  for (const o of obras) {
    const status = statusCalculadoObra(o.status, o.dataInicioPrev, o.dataFimPrev, o.etapas, hoje);
    const realizado = o.recibos.reduce((s, r) => s + r.valor, 0);
    const estouro = (o.orcamento ?? 0) > 0 && realizado > (o.orcamento ?? 0);
    secao(d, o.titulo);
    paragrafo(
      d,
      `Status: ${STATUS_OBRA_LABEL[status]} · Período previsto: ${formatarData(o.dataInicioPrev)} a ${formatarData(
        o.dataFimPrev
      )} · Responsável: ${o.responsavel?.nome ?? "—"}`
    );
    paragrafo(
      d,
      `Orçado: ${formatarMoeda(o.orcamento)} · Realizado: ${formatarMoeda(realizado)}${
        estouro ? ` · ESTOURO de ${formatarMoeda(realizado - (o.orcamento ?? 0))}` : ""
      }`
    );
    if (o.etapas.length > 0) {
      tabela(
        d,
        [
          { titulo: "Etapa", largura: 180 },
          { titulo: "Previsto", largura: 150 },
          { titulo: "Progresso", largura: 80, alinhar: "direita" },
          { titulo: "Situação", largura: 105 },
        ],
        o.etapas.map((e) => {
          const atrasada = etapaAtrasada(e, hoje);
          return [
            e.nome,
            `${formatarData(e.inicioPrev)} a ${formatarData(e.fimPrev)}`,
            `${e.progresso}%`,
            atrasada
              ? `Atrasada +${diasAtraso(e, hoje)}d`
              : e.progresso === 100
              ? "Concluída"
              : "Em dia",
          ];
        })
      );
    }
  }

  const bytes = await finalizar(d);
  return { bytes, nomeArquivo: "relatorio-obras.pdf", titulo: "Relatório de Obras" };
}

async function relatorioFornecedores(nome: string) {
  const fornecedores = await prisma.fornecedor.findMany({
    orderBy: { nome: "asc" },
    include: { servicos: { orderBy: { nome: "asc" } } },
  });

  const d = await novoDoc(
    `${nome} — Relatório de Fornecedores`,
    `Emitido em ${formatarData(new Date())}`
  );

  kpis(d, [
    { label: "Fornecedores", valor: String(fornecedores.length) },
    { label: "Serviços", valor: String(fornecedores.reduce((s, f) => s + f.servicos.length, 0)) },
    { label: "—", valor: "" },
  ]);

  secao(d, "Fornecedores");
  tabela(
    d,
    [
      { titulo: "Nome", largura: 160 },
      { titulo: "CNPJ/CPF", largura: 120 },
      { titulo: "Telefone", largura: 110 },
      { titulo: "Serviços", largura: 125, alinhar: "direita" },
    ],
    fornecedores.map((f) => [f.nome, f.cnpjCpf ?? "—", f.telefone ?? "—", String(f.servicos.length)])
  );

  for (const f of fornecedores) {
    if (f.servicos.length === 0) continue;
    secao(d, `Serviços — ${f.nome}`);
    tabela(
      d,
      [
        { titulo: "Serviço", largura: 280 },
        { titulo: "Unidade", largura: 110 },
        { titulo: "Valor padrão", largura: 125, alinhar: "direita" },
      ],
      f.servicos.map((s) => [s.nome, s.unidade ?? "—", formatarMoeda(s.valorPadrao)])
    );
  }

  const bytes = await finalizar(d);
  return { bytes, nomeArquivo: "relatorio-fornecedores.pdf", titulo: "Relatório de Fornecedores" };
}

async function relatorioManutencao(nome: string, hoje: Date) {
  const ordens = await prisma.ordemServico.findMany({
    orderBy: { numero: "desc" },
    include: {
      subOrdens: { orderBy: { ordem: "asc" } },
      responsavel: { select: { nome: true } },
      fornecedor: { select: { nome: true } },
    },
  });

  const comStatus = ordens.map((o) => ({
    o,
    status: statusCalculadoOS(o.status, o.dataPrevista, o.subOrdens, hoje),
  }));
  const atrasadas = comStatus.filter((x) => x.status === "ATRASADA").length;
  const abertas = comStatus.filter(
    (x) => x.status === "ABERTA" || x.status === "EM_ANDAMENTO"
  ).length;
  const concluidas = comStatus.filter((x) => x.status === "CONCLUIDA").length;
  const custoTotal = ordens.reduce(
    (s, o) => s + (o.custo ?? 0) + o.subOrdens.reduce((a, b) => a + (b.custo ?? 0), 0),
    0
  );

  const d = await novoDoc(`${nome} — Relatório de Manutenção`, `Emitido em ${formatarData(hoje)}`);

  kpis(d, [
    { label: "Total de OS", valor: String(ordens.length) },
    { label: "Em aberto", valor: String(abertas) },
    { label: "Atrasadas", valor: String(atrasadas) },
    { label: "Concluídas", valor: String(concluidas) },
    { label: "Custo total", valor: formatarMoeda(custoTotal) },
    { label: "—", valor: "" },
  ]);

  secao(d, "Ordens de Serviço");
  if (ordens.length === 0) {
    paragrafo(d, "Nenhuma ordem de serviço cadastrada.");
  } else {
    tabela(
      d,
      [
        { titulo: "OS", largura: 40 },
        { titulo: "Título", largura: 150 },
        { titulo: "Tipo", largura: 80 },
        { titulo: "Status", largura: 80 },
        { titulo: "Prazo", largura: 70 },
        { titulo: "Prog.", largura: 45, alinhar: "direita" },
        { titulo: "Custo", largura: 50, alinhar: "direita" },
      ],
      comStatus.map(({ o, status }) => [
        `#${o.numero}`,
        o.titulo,
        o.tipo,
        STATUS_OS_LABEL[status],
        o.dataPrevista ? formatarData(o.dataPrevista) : "—",
        `${progressoOS(o.subOrdens)}%`,
        formatarMoeda((o.custo ?? 0) + o.subOrdens.reduce((a, b) => a + (b.custo ?? 0), 0)),
      ])
    );
  }

  // Detalhe das sub-OS por OS
  for (const { o } of comStatus) {
    if (o.subOrdens.length === 0) continue;
    secao(d, `Sub-OS — #${o.numero} ${o.titulo}`);
    tabela(
      d,
      [
        { titulo: "Sub-OS", largura: 320 },
        { titulo: "Status", largura: 110 },
        { titulo: "Custo", largura: 85, alinhar: "direita" },
      ],
      o.subOrdens.map((s) => [s.titulo, s.status, formatarMoeda(s.custo)])
    );
  }

  const bytes = await finalizar(d);
  return { bytes, nomeArquivo: "relatorio-manutencao.pdf", titulo: "Relatório de Manutenção" };
}

async function relatorioAuditoria(nome: string, mesReferencia: string | undefined, hoje: Date) {
  const { inicio, fim, rotulo } = nomeMes(mesReferencia);
  const registros = await prisma.auditoria.findMany({
    where: inicio && fim ? { criadoEm: { gte: inicio, lt: fim } } : {},
    orderBy: { criadoEm: "desc" },
    take: 1000,
  });

  const d = await novoDoc(
    `${nome} — Relatório de Auditoria`,
    `Período: ${rotulo} · Emitido em ${formatarData(hoje)}`
  );

  kpis(d, [
    { label: "Ações registradas", valor: String(registros.length) },
    { label: "Período", valor: rotulo },
    { label: "—", valor: "" },
  ]);

  secao(d, "Histórico de ações");
  if (registros.length === 0) {
    paragrafo(d, "Nenhuma ação registrada no período.");
  } else {
    tabela(
      d,
      [
        { titulo: "Data/hora", largura: 95 },
        { titulo: "Usuário", largura: 110 },
        { titulo: "Ação", largura: 60 },
        { titulo: "Tipo", largura: 70 },
        { titulo: "Detalhe", largura: 180 },
      ],
      registros.map((r) => [
        formatarDataHora(r.criadoEm),
        r.usuarioNome,
        ACAO_LABEL[r.acao] ?? r.acao,
        r.entidade,
        (r.detalhe ?? "").slice(0, 60),
      ])
    );
  }

  const bytes = await finalizar(d);
  return { bytes, nomeArquivo: "relatorio-auditoria.pdf", titulo: "Relatório de Auditoria" };
}

async function relatorioGeral(nome: string, hoje: Date) {
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [recibos, obras, fornecedores] = await Promise.all([
    prisma.recibo.findMany(),
    prisma.obra.findMany({ include: { etapas: true } }),
    prisma.fornecedor.count(),
  ]);

  const gastoMes = recibos.filter((r) => r.dataEmissao >= inicioMes).reduce((s, r) => s + r.valor, 0);
  const gastoTotal = recibos.reduce((s, r) => s + r.valor, 0);
  const ativas = obras.filter((o) => statusCalculadoObra(o.status, o.dataInicioPrev, o.dataFimPrev, o.etapas, hoje) !== "CONCLUIDA").length;
  const etapasAtrasadas = obras.flatMap((o) => o.etapas.filter((e) => etapaAtrasada(e, hoje))).length;

  const d = await novoDoc(
    `${nome} — Prestação de Contas`,
    `Emitido em ${formatarData(hoje)}`
  );

  kpis(d, [
    { label: "Gasto no mês", valor: formatarMoeda(gastoMes) },
    { label: "Gasto total", valor: formatarMoeda(gastoTotal) },
    { label: "Obras ativas", valor: String(ativas) },
    { label: "Etapas atrasadas", valor: String(etapasAtrasadas) },
    { label: "Recibos", valor: String(recibos.length) },
    { label: "Fornecedores", valor: String(fornecedores) },
  ]);

  const porCategoria = new Map<string, number>();
  recibos.forEach((r) => porCategoria.set(r.categoria, (porCategoria.get(r.categoria) ?? 0) + r.valor));
  secao(d, "Resumo financeiro por categoria");
  tabela(
    d,
    [
      { titulo: "Categoria", largura: 360 },
      { titulo: "Valor", largura: 155, alinhar: "direita" },
    ],
    [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, formatarMoeda(v)])
  );
  totalLinha(d, "TOTAL GERAL", formatarMoeda(gastoTotal));

  secao(d, "Situação das obras");
  if (obras.length === 0) {
    paragrafo(d, "Nenhuma obra cadastrada.");
  } else {
    tabela(
      d,
      [
        { titulo: "Obra", largura: 220 },
        { titulo: "Status", largura: 120 },
        { titulo: "Progresso", largura: 85, alinhar: "direita" },
        { titulo: "Atraso", largura: 90, alinhar: "direita" },
      ],
      obras.map((o) => {
        const status = statusCalculadoObra(o.status, o.dataInicioPrev, o.dataFimPrev, o.etapas, hoje);
        const prog =
          o.etapas.length > 0
            ? Math.round(o.etapas.reduce((s, e) => s + e.progresso, 0) / o.etapas.length)
            : 0;
        const dias = o.etapas.filter((e) => etapaAtrasada(e, hoje)).reduce((s, e) => s + diasAtraso(e, hoje), 0);
        return [o.titulo, STATUS_OBRA_LABEL[status], `${prog}%`, dias > 0 ? `${dias}d` : "—"];
      })
    );
  }

  const bytes = await finalizar(d);
  return { bytes, nomeArquivo: "prestacao-de-contas.pdf", titulo: "Prestação de Contas" };
}
