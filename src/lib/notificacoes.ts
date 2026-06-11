// Motor de notificações in-app. Estratégia "lazy" (roda ao abrir o app, com throttle),
// igual às recorrências. Gera notificações apenas para usuários marcados como destinatários
// (User.recebeNotificacoes = true), com deduplicação por (usuário, tipo, entidade).

import { prisma } from "@/lib/prisma";
import { formatarMoeda, formatarDataHora } from "@/lib/utils";
import { getConfiguracao } from "@/lib/config";
import { statusCalculadoObra, etapaAtrasada } from "@/lib/obras";
import { statusCalculadoOS } from "@/lib/manutencao";

let ultimaExecucao = 0;
const INTERVALO_MS = 5 * 60 * 1000;

type Evento = {
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string;
  entidadeId: string;
};

export const NOTIF_LABEL: Record<string, string> = {
  OS_ATRASADA: "OS atrasada",
  OBRA_ATRASADA: "Obra atrasada",
  ORCAMENTO_ESTOURADO: "Orçamento estourado",
  CONTA_FIXA_PENDENTE: "Conta fixa pendente",
  EVENTO_PROXIMO: "Evento em breve",
};

/** Coleta os eventos de alerta atuais (globais, independem do destinatário). */
async function coletarEventos(hoje: Date): Promise<Evento[]> {
  const eventos: Evento[] = [];

  const [ordens, obras, recibosFixos] = await Promise.all([
    prisma.ordemServico.findMany({ include: { subOrdens: { select: { status: true } } } }),
    prisma.obra.findMany({ include: { etapas: true, recibos: { select: { valor: true } } } }),
    prisma.recibo.findMany({
      where: { status: "PENDENTE", recorrenciaId: { not: null } },
      select: { id: true, descricao: true, valor: true },
    }),
  ]);

  for (const o of ordens) {
    if (statusCalculadoOS(o.status, o.dataPrevista, o.subOrdens, hoje) === "ATRASADA") {
      eventos.push({
        tipo: "OS_ATRASADA",
        titulo: `OS #${o.numero} atrasada`,
        mensagem: `A ordem de serviço "${o.titulo}" (${o.tipo}) passou do prazo.`,
        link: `/manutencao/${o.id}`,
        entidadeId: o.id,
      });
    }
  }

  for (const o of obras) {
    const status = statusCalculadoObra(o.status, o.dataInicioPrev, o.dataFimPrev, o.etapas, hoje);
    if (status === "ATRASADA") {
      eventos.push({
        tipo: "OBRA_ATRASADA",
        titulo: "Obra atrasada",
        mensagem: `A obra "${o.titulo}" está atrasada.`,
        link: `/obras/${o.id}`,
        entidadeId: o.id,
      });
    }
    const realizado = o.recibos.reduce((s, r) => s + r.valor, 0);
    if ((o.orcamento ?? 0) > 0 && realizado > (o.orcamento ?? 0)) {
      eventos.push({
        tipo: "ORCAMENTO_ESTOURADO",
        titulo: "Orçamento estourado",
        mensagem: `A obra "${o.titulo}" estourou o orçamento: realizado ${formatarMoeda(
          realizado
        )} (orçado ${formatarMoeda(o.orcamento)}).`,
        link: `/obras/${o.id}`,
        entidadeId: o.id,
      });
    }
  }

  for (const r of recibosFixos) {
    eventos.push({
      tipo: "CONTA_FIXA_PENDENTE",
      titulo: "Conta fixa pendente",
      mensagem: `${r.descricao ?? "Conta fixa"} — ${formatarMoeda(r.valor)} aguardando conferência.`,
      link: `/recibos`,
      entidadeId: r.id,
    });
  }

  return eventos;
}

/** Gera notificações novas para os destinatários, sem duplicar as já existentes. */
export async function gerarNotificacoes(force = false): Promise<number> {
  const agora = Date.now();
  if (!force && agora - ultimaExecucao < INTERVALO_MS) return 0;
  ultimaExecucao = agora;

  const hoje = new Date();
  type Cand = {
    usuarioId: string;
    tipo: string;
    titulo: string;
    mensagem: string;
    link: string;
    entidadeId: string;
  };
  const candidatos: Cand[] = [];

  // 1) Alertas gerais (OS/obra/orçamento/conta fixa) → todos os destinatários marcados.
  const destinatarios = await prisma.user.findMany({
    where: { ativo: true, recebeNotificacoes: true },
    select: { id: true },
  });
  if (destinatarios.length > 0) {
    const eventos = await coletarEventos(hoje);
    for (const d of destinatarios) {
      for (const ev of eventos) candidatos.push({ usuarioId: d.id, ...ev });
    }
  }

  // 2) Eventos próximos → APENAS o RESPONSÁVEL de cada evento. Antecedência configurável.
  const config = await getConfiguracao();
  const horas = config.horasAvisoEvento > 0 ? config.horasAvisoEvento : 48;
  const limite = new Date(hoje.getTime() + horas * 60 * 60 * 1000);
  const eventosProximos = await prisma.evento.findMany({
    where: {
      status: { not: "CANCELADO" },
      responsavelId: { not: null },
      dataInicio: { gte: hoje, lte: limite },
    },
  });
  for (const e of eventosProximos) {
    if (!e.responsavelId) continue;
    candidatos.push({
      usuarioId: e.responsavelId,
      tipo: "EVENTO_PROXIMO",
      titulo: `Evento em breve: ${e.titulo}`,
      mensagem: `${e.tipo}${e.local ? ` em ${e.local}` : ""} — ${formatarDataHora(e.dataInicio)}.`,
      link: "/eventos",
      entidadeId: e.id,
    });
  }

  if (candidatos.length === 0) return 0;

  // Dedup contra notificações já existentes dos usuários envolvidos.
  const userIds = [...new Set(candidatos.map((c) => c.usuarioId))];
  const existentes = await prisma.notificacao.findMany({
    where: { usuarioId: { in: userIds } },
    select: { usuarioId: true, tipo: true, entidadeId: true },
  });
  const chave = (u: string, t: string, e: string | null) => `${u}|${t}|${e ?? ""}`;
  const jaExiste = new Set(existentes.map((n) => chave(n.usuarioId, n.tipo, n.entidadeId)));

  const novas = candidatos.filter((c) => !jaExiste.has(chave(c.usuarioId, c.tipo, c.entidadeId)));
  if (novas.length === 0) return 0;
  await prisma.notificacao.createMany({ data: novas });
  return novas.length;
}
