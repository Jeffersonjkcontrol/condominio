import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ehAdmin, podeUsarAssistente } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { getConfiguracao } from "@/lib/config";
import {
  conversar,
  type Mensagem,
  type Provedor,
  type ExecutorRelatorio,
  type Ferramenta,
  type ExecutorFerramenta,
} from "@/lib/ai-providers";
import { type TipoRelatorio } from "@/lib/relatorios";
import { formatarMoeda, formatarData, formatarDataHora } from "@/lib/utils";
import { etapaAtrasada, diasAtraso, statusCalculadoObra } from "@/lib/obras";
import { statusCalculadoOS, progressoOS } from "@/lib/manutencao";
import { statusCalculadoEvento } from "@/lib/eventos";
import { PAPEL_LABEL } from "@/lib/permissoes";
import { foraDeEscopo, mensagemRecusa } from "@/lib/escopo";

/** Cria a conversa (se nova) e grava o par usuário/assistente. Retorna o id da conversa. */
async function persistir(
  conversaId: string | undefined,
  provedor: string,
  userContent: string,
  assistantContent: string,
  arquivoUrl: string | undefined,
  userId: string
): Promise<string> {
  let id = conversaId;
  if (id) {
    const existe = await prisma.conversa.findFirst({ where: { id, criadoPorId: userId } });
    if (!existe) id = undefined;
  }
  if (!id) {
    const nova = await prisma.conversa.create({
      data: {
        titulo: userContent.slice(0, 60) || "Nova conversa",
        provedor,
        criadoPorId: userId,
      },
    });
    id = nova.id;
  } else {
    await prisma.conversa.update({ where: { id }, data: { provedor } });
  }
  await prisma.mensagemIA.createMany({
    data: [
      { conversaId: id, role: "user", content: userContent },
      { conversaId: id, role: "assistant", content: assistantContent, arquivoUrl: arquivoUrl ?? null },
    ],
  });
  return id;
}

const MAX_RECIBOS = 40; // limita o tamanho do contexto

/** Monta um retrato dos dados do condomínio para dar contexto à IA.
 *  `incluirSensivel` (apenas Admin) controla a inclusão de usuários e auditoria. */
async function montarContexto(nomeCondominio: string, incluirSensivel: boolean): Promise<string> {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [recibos, obras, fornecedores, ordens, usuarios, auditoria] = await Promise.all([
    prisma.recibo.findMany({
      orderBy: { dataEmissao: "desc" },
      include: { fornecedor: { select: { nome: true } }, obra: { select: { titulo: true } } },
    }),
    prisma.obra.findMany({
      include: {
        etapas: { orderBy: { ordem: "asc" } },
        responsavel: { select: { nome: true } },
        recibos: { select: { valor: true } },
      },
    }),
    prisma.fornecedor.findMany({ include: { servicos: true } }),
    prisma.ordemServico.findMany({
      include: {
        subOrdens: { orderBy: { ordem: "asc" } },
        responsavel: { select: { nome: true } },
        fornecedor: { select: { nome: true } },
      },
    }),
    prisma.user.findMany({ select: { nome: true, email: true, papel: true, ativo: true } }),
    prisma.auditoria.findMany({ orderBy: { criadoEm: "desc" }, take: 20 }),
  ]);

  const recorrencias = await prisma.recorrencia.findMany({
    include: { fornecedor: { select: { nome: true } } },
  });

  const eventos = await prisma.evento.findMany({
    where: { dataFim: { gte: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1) } },
    orderBy: { dataInicio: "asc" },
    include: { responsavel: { select: { nome: true } } },
    take: 50,
  });

  // Memórias permanentes (fatos/instruções que o assistente deve sempre lembrar)
  const memorias = await prisma.memoriaIA.findMany({ orderBy: { criadoEm: "asc" } });
  const memoriasTxt = memorias.map((m) => `- ${m.conteudo}`).join("\n");

  // ---- Financeiro ----
  const gastoMes = recibos
    .filter((r) => r.dataEmissao >= inicioMes)
    .reduce((s, r) => s + r.valor, 0);
  const gastoTotal = recibos.reduce((s, r) => s + r.valor, 0);
  const pendentes = recibos.filter((r) => r.status === "PENDENTE").length;
  const porCategoria = new Map<string, number>();
  recibos.forEach((r) =>
    porCategoria.set(r.categoria, (porCategoria.get(r.categoria) ?? 0) + r.valor)
  );
  const categoriasTxt = [...porCategoria.entries()]
    .map(([c, v]) => `${c}: ${formatarMoeda(v)}`)
    .join("; ");

  const recibosTxt = recibos
    .slice(0, MAX_RECIBOS)
    .map(
      (r) =>
        `- ${formatarData(r.dataEmissao)} | ${r.categoria} | ${r.fornecedor?.nome ?? "sem fornecedor"} | ${formatarMoeda(
          r.valor
        )} | ${r.status === "CONFERIDO" ? "conferido" : "pendente"}${r.obra ? ` | obra: ${r.obra.titulo}` : ""}${
          r.descricao ? ` | ${r.descricao}` : ""
        }`
    )
    .join("\n");

  // ---- Fornecedores e serviços ----
  const fornecedoresTxt = fornecedores
    .map((f) => {
      const serv = f.servicos
        .map((s) => `${s.nome}${s.valorPadrao != null ? ` (${formatarMoeda(s.valorPadrao)})` : ""}`)
        .join(", ");
      return `- ${f.nome}${f.cnpjCpf ? ` [${f.cnpjCpf}]` : ""}${f.telefone ? ` tel ${f.telefone}` : ""}${
        f.email ? ` ${f.email}` : ""
      }${serv ? ` | serviços: ${serv}` : ""}`;
    })
    .join("\n");

  // ---- Obras ----
  const obrasTxt = obras
    .map((o) => {
      const status = statusCalculadoObra(o.status, o.dataInicioPrev, o.dataFimPrev, o.etapas, hoje);
      const realizado = o.recibos.reduce((s, r) => s + r.valor, 0);
      const atrasadas = o.etapas.filter((e) => etapaAtrasada(e, hoje));
      const dias = atrasadas.reduce((s, e) => s + diasAtraso(e, hoje), 0);
      const etapasTxt = o.etapas
        .map(
          (e) =>
            `    · ${e.nome}: ${e.progresso}% (${formatarData(e.inicioPrev)}→${formatarData(e.fimPrev)})${
              etapaAtrasada(e, hoje) ? ` ATRASADA +${diasAtraso(e, hoje)}d` : ""
            }`
        )
        .join("\n");
      return `- "${o.titulo}" (${status}) | período ${formatarData(o.dataInicioPrev)}→${formatarData(
        o.dataFimPrev
      )} | orçado ${formatarMoeda(o.orcamento)} / realizado ${formatarMoeda(realizado)}${
        atrasadas.length ? ` | ${atrasadas.length} etapa(s) atrasada(s), ${dias}d` : ""
      }${o.responsavel?.nome ? ` | resp. ${o.responsavel.nome}` : ""}${etapasTxt ? `\n${etapasTxt}` : ""}`;
    })
    .join("\n");

  // ---- Manutenção (OS + sub-OS) ----
  const osTxt = ordens
    .map((o) => {
      const status = statusCalculadoOS(o.status, o.dataPrevista, o.subOrdens, hoje);
      const subTxt = o.subOrdens
        .map((s) => `    · ${s.titulo}: ${s.status.toLowerCase()}${s.custo != null ? ` (${formatarMoeda(s.custo)})` : ""}`)
        .join("\n");
      return `- OS #${o.numero} "${o.titulo}" | tipo ${o.tipo} | ${status} | progresso ${progressoOS(
        o.subOrdens
      )}%${o.dataPrevista ? ` | prazo ${formatarData(o.dataPrevista)}` : ""}${o.local ? ` | local ${o.local}` : ""}${
        o.custo != null ? ` | custo ${formatarMoeda(o.custo)}` : ""
      }${o.responsavel?.nome ? ` | resp. ${o.responsavel.nome}` : ""}${o.fornecedor?.nome ? ` | fornecedor ${o.fornecedor.nome}` : ""}${
        subTxt ? `\n${subTxt}` : ""
      }`;
    })
    .join("\n");

  // ---- Usuários ----
  const usuariosTxt = usuarios
    .map((u) => `- ${u.nome} (${PAPEL_LABEL[u.papel]})${u.ativo ? "" : " [inativo]"} — ${u.email}`)
    .join("\n");

  // ---- Contas fixas (recorrências) ----
  const totalFixo = recorrencias.filter((r) => r.ativo).reduce((s, r) => s + r.valor, 0);
  const recorrenciasTxt = recorrencias
    .map(
      (r) =>
        `- ${r.descricao} | ${r.categoria} | ${formatarMoeda(r.valor)}/mês | vence dia ${r.diaVencimento} | ${
          r.ativo ? "ativa" : "pausada"
        }${r.fornecedor?.nome ? ` | ${r.fornecedor.nome}` : ""}`
    )
    .join("\n");

  // ---- Eventos / agenda ----
  const eventosTxt = eventos
    .map((e) => {
      const status = statusCalculadoEvento(e.status, e.dataInicio, e.dataFim, hoje);
      return `- ${e.titulo} | ${e.tipo} | ${status} | ${formatarDataHora(e.dataInicio)} a ${formatarDataHora(
        e.dataFim
      )}${e.local ? ` | local ${e.local}` : ""}${e.reservante ? ` | reservante ${e.reservante}` : ""}${
        e.responsavel?.nome ? ` | resp. ${e.responsavel.nome}` : ""
      }`;
    })
    .join("\n");

  // ---- Atividade recente (auditoria) ----
  const auditoriaTxt = auditoria
    .map((a) => `- ${formatarDataHora(a.criadoEm)} | ${a.usuarioNome} ${a.acao} ${a.entidade}: ${a.detalhe ?? ""}`)
    .join("\n");

  // Seções sensíveis (usuários e auditoria) só entram para o síndico/admin.
  const blocoSensivel = incluirSensivel
    ? `

== USUÁRIOS DO SISTEMA (${usuarios.length}) ==
${usuariosTxt || "nenhum"}

== ATIVIDADE RECENTE (auditoria, últimas 20 ações) ==
${auditoriaTxt || "nenhuma"}`
    : "";

  return `DADOS COMPLETOS DO CONDOMÍNIO "${nomeCondominio}" (em ${formatarData(hoje)}).
Use estes dados como base factual. "Obras" (reformas/construções com cronograma) e "Manutenção/OS"
(ordens de serviço internas: jardinagem, elétrica, hidráulica, etc.) são coisas DISTINTAS.

== MEMÓRIAS / INSTRUÇÕES PERMANENTES (fatos que você DEVE sempre lembrar e respeitar) ==
${memoriasTxt || "nenhuma memória cadastrada ainda"}

== FINANCEIRO ==
Gasto no mês: ${formatarMoeda(gastoMes)} | Gasto total: ${formatarMoeda(gastoTotal)}
Recibos: ${recibos.length} (${pendentes} pendentes) | Gastos por categoria: ${categoriasTxt || "nenhum"}

== RECIBOS (mais recentes${recibos.length > MAX_RECIBOS ? `, ${MAX_RECIBOS} de ${recibos.length}` : ""}) ==
${recibosTxt || "nenhum"}

== FORNECEDORES E SERVIÇOS (${fornecedores.length}) ==
${fornecedoresTxt || "nenhum"}

== OBRAS (${obras.length}) ==
${obrasTxt || "nenhuma"}

== MANUTENÇÃO — ORDENS DE SERVIÇO (${ordens.length}) ==
${osTxt || "nenhuma"}

== CONTAS FIXAS / RECORRÊNCIAS (${recorrencias.length}) — compromisso mensal fixo ${formatarMoeda(totalFixo)} ==
${recorrenciasTxt || "nenhuma"}

== EVENTOS / AGENDA (próximos e recentes, ${eventos.length}) — assembleias, reuniões, reservas de espaços ==
${eventosTxt || "nenhum"}${blocoSensivel}`;
}

const TIPOS_VALIDOS_REL: TipoRelatorio[] = [
  "financeiro",
  "obras",
  "fornecedores",
  "geral",
  "manutencao",
  "auditoria",
];

const NOME_REL: Record<string, string> = {
  financeiro: "Financeiro",
  obras: "Obras",
  fornecedores: "Fornecedores",
  geral: "Prestação de contas",
  manutencao: "Manutenção",
  auditoria: "Auditoria",
};

// ---- Definições das ferramentas (function calling) ----
const FERRAMENTA_RELATORIO: Ferramenta = {
  name: "gerar_relatorio",
  description:
    "Gera um relatório do condomínio em PDF (financeiro, obras, manutenção, fornecedores, auditoria ou prestação de contas geral). Use quando o usuário pedir um relatório, PDF ou prestação de contas.",
  parameters: {
    type: "object",
    properties: {
      tipo: {
        type: "string",
        enum: ["financeiro", "obras", "fornecedores", "geral", "manutencao", "auditoria"],
        description:
          "Tipo do relatório: financeiro (recibos/gastos), obras (cronograma e atrasos), manutencao (ordens de serviço), fornecedores, auditoria (rastreabilidade), geral (prestação de contas).",
      },
      mesReferencia: {
        type: "string",
        description: "Mês de referência no formato AAAA-MM. Opcional, usado no relatório financeiro.",
      },
    },
    required: ["tipo"],
  },
};

const FERRAMENTA_MEMORIA: Ferramenta = {
  name: "salvar_memoria",
  description:
    "Salva um fato ou instrução PERMANENTE sobre o condomínio para você lembrar em TODAS as conversas futuras. Use quando o usuário informar algo duradouro: nomes (zelador, síndico), regras, preferências, contatos, datas/vencimentos fixos, valores de referência. NÃO use para perguntas pontuais nem para coisas que já estão nos dados do condomínio.",
  parameters: {
    type: "object",
    properties: {
      conteudo: {
        type: "string",
        description: "O fato a memorizar, em uma frase curta e objetiva. Ex.: 'O zelador é o João, telefone (19) 99999-0000'.",
      },
    },
    required: ["conteudo"],
  },
};

/** Executor da ferramenta: devolve o link da rota que gera o PDF na hora (/api/relatorios).
 *  Isso funciona em dev e produção (não depende de gravar arquivo em /public). */
const executarRelatorio: ExecutorRelatorio = async ({ tipo, mesReferencia }) => {
  const t = (TIPOS_VALIDOS_REL.includes(tipo as TipoRelatorio) ? tipo : "geral") as TipoRelatorio;
  const qs = `tipo=${t}${mesReferencia ? `&mes=${encodeURIComponent(mesReferencia)}` : ""}`;
  return {
    resultado: `Relatório de ${NOME_REL[t] ?? t} pronto. Avise o usuário para baixar pelo botão abaixo.`,
    arquivoUrl: `/api/relatorios?${qs}`,
  };
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  if (!podeUsarAssistente(session.user.papel, session.user.podeUsarIA)) {
    return NextResponse.json({ erro: "Sem acesso ao Assistente IA." }, { status: 403 });
  }
  const isAdmin = ehAdmin(session.user.papel);

  let body: { provedor?: Provedor; mensagens?: Mensagem[]; conversaId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const { provedor, mensagens, conversaId } = body;
  if (!provedor || !Array.isArray(mensagens) || mensagens.length === 0) {
    return NextResponse.json({ erro: "Provedor e mensagens são obrigatórios." }, { status: 400 });
  }

  const config = await getConfiguracao();
  const ultimaUser = [...mensagens].reverse().find((m) => m.role === "user")?.content ?? "";

  // Bloqueio de escopo: recusa local, sem consumir a API.
  if (foraDeEscopo(ultimaUser)) {
    const recusa = mensagemRecusa(config.nomeCondominio);
    const id = await persistir(conversaId, provedor, ultimaUser, recusa, undefined, session.user.id);
    return NextResponse.json({ resposta: recusa, conversaId: id, bloqueado: true });
  }

  const contexto = await montarContexto(config.nomeCondominio, isAdmin);

  // Ferramentas disponíveis: relatório (todos) + salvar memória (só Admin gerencia memórias).
  const ferramentas: Ferramenta[] = [
    FERRAMENTA_RELATORIO,
    ...(isAdmin ? [FERRAMENTA_MEMORIA] : []),
  ];

  const executar: ExecutorFerramenta = async (nome, entrada) => {
    if (nome === "salvar_memoria") {
      if (!isAdmin) return { resultado: "Apenas o síndico/admin pode salvar memórias." };
      const conteudo = String(entrada.conteudo ?? "").trim();
      if (!conteudo) return { resultado: "Não havia conteúdo para salvar." };
      await prisma.memoriaIA.create({
        data: { conteudo, origem: "IA", criadoPorNome: session.user.name ?? "IA" },
      });
      return {
        resultado: `Memória salva: "${conteudo}". O síndico pode revisar/editar/remover em Configurações.`,
      };
    }
    // gerar_relatorio — Gestor não pode gerar o de auditoria (dado sensível, só Admin).
    const tipo = String(entrada.tipo ?? "geral");
    if (tipo === "auditoria" && !isAdmin) {
      return { resultado: "Relatório de auditoria é restrito ao síndico/admin." };
    }
    return executarRelatorio({
      tipo,
      mesReferencia: entrada.mesReferencia ? String(entrada.mesReferencia) : undefined,
    });
  };

  const system = `Você é o assistente virtual de gestão do condomínio "${config.nomeCondominio}".
Sua função é EXCLUSIVAMENTE ajudar o síndico com a administração deste condomínio: recibos e
finanças, fornecedores e serviços, obras, cronogramas, atrasos e relatórios.
Se a pergunta NÃO for sobre a gestão do condomínio, recuse educadamente em uma frase e convide o
usuário a reformular dentro desse escopo — não responda assuntos fora disso (programação, receitas,
atualidades, tradução, etc.).
Responda sempre em português do Brasil, de forma objetiva e prática.
Use os dados abaixo como base factual quando a pergunta for sobre o condomínio.
Quando o usuário pedir um relatório, PDF ou prestação de contas, use a ferramenta "gerar_relatorio"
e, depois, confirme em uma frase curta que o PDF foi gerado.${
    isAdmin
      ? `
Você também tem uma MEMÓRIA permanente: quando o usuário informar um fato duradouro (nomes, regras,
preferências, contatos, vencimentos fixos), use a ferramenta "salvar_memoria" para registrá-lo e
confirme em uma frase. Respeite sempre as "MEMÓRIAS / INSTRUÇÕES PERMANENTES" listadas abaixo.`
      : ""
  }

${contexto}`;

  try {
    const { resposta, arquivoUrl } = await conversar(
      provedor,
      config,
      system,
      mensagens,
      ferramentas,
      executar
    );
    const id = await persistir(conversaId, provedor, ultimaUser, resposta, arquivoUrl, session.user.id);
    return NextResponse.json({ resposta, arquivoUrl, conversaId: id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao consultar a IA.";
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
}
