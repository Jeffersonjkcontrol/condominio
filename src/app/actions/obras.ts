"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";

async function exigirGestor() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (!podeEditar(session.user.papel)) throw new Error("Sem permissão.");
  return session;
}

const obraSchema = z.object({
  titulo: z.string().min(1, "Informe o título."),
  descricao: z.string().optional(),
  orcamento: z.coerce.number().optional(),
  dataInicioPrev: z.string().min(1, "Informe a data de início."),
  dataFimPrev: z.string().min(1, "Informe a data de término."),
  concluida: z.boolean().optional(),
  responsavelId: z.string().optional(),
});

function lerObra(formData: FormData) {
  const orc = formData.get("orcamento");
  return obraSchema.parse({
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || undefined,
    orcamento: orc ? Number(orc) : undefined,
    dataInicioPrev: formData.get("dataInicioPrev"),
    dataFimPrev: formData.get("dataFimPrev"),
    concluida: formData.get("concluida") === "on",
    responsavelId: formData.get("responsavelId") || undefined,
  });
}

export async function criarObra(formData: FormData) {
  await exigirGestor();
  const d = lerObra(formData);
  const obra = await prisma.obra.create({
    data: {
      titulo: d.titulo,
      descricao: d.descricao,
      orcamento: d.orcamento,
      dataInicioPrev: new Date(d.dataInicioPrev),
      dataFimPrev: new Date(d.dataFimPrev),
      status: d.concluida ? "CONCLUIDA" : "EM_ANDAMENTO",
      responsavelId: d.responsavelId || null,
    },
  });
  await registrar("CRIOU", "Obra", d.titulo, obra.id);
  revalidatePath("/obras");
}

export async function atualizarObra(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const d = lerObra(formData);
  await prisma.obra.update({
    where: { id },
    data: {
      titulo: d.titulo,
      descricao: d.descricao,
      orcamento: d.orcamento,
      dataInicioPrev: new Date(d.dataInicioPrev),
      dataFimPrev: new Date(d.dataFimPrev),
      status: d.concluida ? "CONCLUIDA" : "EM_ANDAMENTO",
      responsavelId: d.responsavelId || null,
    },
  });
  await registrar(d.concluida ? "CONCLUIU" : "EDITOU", "Obra", d.titulo, id);
  revalidatePath("/obras");
  revalidatePath(`/obras/${id}`);
}

export async function excluirObra(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const obra = await prisma.obra.findUnique({ where: { id } });
  await prisma.obra.delete({ where: { id } });
  if (obra) await registrar("EXCLUIU", "Obra", obra.titulo, id);
  revalidatePath("/obras");
}

// ---- Etapas ----

const etapaSchema = z.object({
  obraId: z.string().min(1),
  nome: z.string().min(1, "Informe o nome da etapa."),
  inicioPrev: z.string().min(1),
  fimPrev: z.string().min(1),
  inicioReal: z.string().optional(),
  fimReal: z.string().optional(),
  progresso: z.coerce.number().min(0).max(100).optional(),
  ordem: z.coerce.number().optional(),
});

function lerEtapa(formData: FormData) {
  return etapaSchema.parse({
    obraId: formData.get("obraId"),
    nome: formData.get("nome"),
    inicioPrev: formData.get("inicioPrev"),
    fimPrev: formData.get("fimPrev"),
    inicioReal: formData.get("inicioReal") || undefined,
    fimReal: formData.get("fimReal") || undefined,
    progresso: formData.get("progresso") ?? 0,
    ordem: formData.get("ordem") ?? 0,
  });
}

/** Datas reais automáticas: progresso>0 carimba o início; progresso=100 carimba o fim.
 *  Datas informadas manualmente têm prioridade. */
function datasReais(d: { inicioReal?: string; fimReal?: string; progresso?: number }) {
  const progresso = d.progresso ?? 0;
  const hoje = new Date();
  const inicioReal = d.inicioReal ? new Date(d.inicioReal) : progresso > 0 ? hoje : null;
  const fimReal = d.fimReal ? new Date(d.fimReal) : progresso >= 100 ? hoje : null;
  return { inicioReal, fimReal };
}

export async function criarEtapa(formData: FormData) {
  await exigirGestor();
  const d = lerEtapa(formData);
  const { inicioReal, fimReal } = datasReais(d);
  await prisma.etapaObra.create({
    data: {
      obraId: d.obraId,
      nome: d.nome,
      inicioPrev: new Date(d.inicioPrev),
      fimPrev: new Date(d.fimPrev),
      inicioReal,
      fimReal,
      progresso: d.progresso ?? 0,
      ordem: d.ordem ?? 0,
    },
  });
  await registrar("CRIOU", "Etapa", `${d.nome} (${d.progresso ?? 0}%)`, d.obraId);
  revalidatePath(`/obras/${d.obraId}`);
}

export async function atualizarEtapa(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const d = lerEtapa(formData);
  const { inicioReal, fimReal } = datasReais(d);
  await prisma.etapaObra.update({
    where: { id },
    data: {
      nome: d.nome,
      inicioPrev: new Date(d.inicioPrev),
      fimPrev: new Date(d.fimPrev),
      inicioReal,
      fimReal,
      progresso: d.progresso ?? 0,
      ordem: d.ordem ?? 0,
    },
  });
  await registrar(
    (d.progresso ?? 0) >= 100 ? "CONCLUIU" : "EDITOU",
    "Etapa",
    `${d.nome} (${d.progresso ?? 0}%)`,
    d.obraId
  );
  revalidatePath(`/obras/${d.obraId}`);
}

export async function excluirEtapa(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const obraId = String(formData.get("obraId"));
  const etapa = await prisma.etapaObra.findUnique({ where: { id } });
  await prisma.etapaObra.delete({ where: { id } });
  if (etapa) await registrar("EXCLUIU", "Etapa", etapa.nome, obraId);
  revalidatePath(`/obras/${obraId}`);
}

// ---- Sub-etapas ----

const subEtapaSchema = z.object({
  etapaId: z.string().min(1),
  titulo: z.string().min(1, "Informe o título da sub-etapa."),
  descricao: z.string().optional(),
  status: z.enum(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA"]).optional(),
  ordem: z.coerce.number().optional(),
});

function lerSubEtapa(formData: FormData) {
  return subEtapaSchema.parse({
    etapaId: formData.get("etapaId"),
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || undefined,
    status: formData.get("status") || undefined,
    ordem: formData.get("ordem") ?? 0,
  });
}

/** Recalcula e PERSISTE o progresso (%) da etapa pela proporção de sub-etapas concluídas,
 *  carimbando as datas reais. Se a etapa ficar sem sub-etapas, não mexe no progresso (volta a ser manual). */
async function recalcularProgressoEtapa(etapaId: string) {
  const subs = await prisma.subEtapa.findMany({ where: { etapaId }, select: { status: true } });
  if (subs.length === 0) return;
  const feitas = subs.filter((s) => s.status === "CONCLUIDA").length;
  const progresso = Math.round((feitas / subs.length) * 100);
  const { inicioReal, fimReal } = datasReais({ progresso });
  await prisma.etapaObra.update({
    where: { id: etapaId },
    data: { progresso, inicioReal, fimReal },
  });
}

export async function criarSubEtapa(formData: FormData) {
  await exigirGestor();
  const d = lerSubEtapa(formData);
  const obraId = String(formData.get("obraId"));
  const status = d.status ?? "PENDENTE";
  await prisma.subEtapa.create({
    data: {
      etapaId: d.etapaId,
      titulo: d.titulo,
      descricao: d.descricao,
      status,
      ordem: d.ordem ?? 0,
      concluidaEm: status === "CONCLUIDA" ? new Date() : null,
    },
  });
  await recalcularProgressoEtapa(d.etapaId);
  await registrar("CRIOU", "Sub-etapa", d.titulo, obraId);
  revalidatePath(`/obras/${obraId}`);
}

export async function atualizarSubEtapa(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const d = lerSubEtapa(formData);
  const obraId = String(formData.get("obraId"));
  const status = d.status ?? "PENDENTE";
  await prisma.subEtapa.update({
    where: { id },
    data: {
      titulo: d.titulo,
      descricao: d.descricao,
      status,
      ordem: d.ordem ?? 0,
      concluidaEm: status === "CONCLUIDA" ? new Date() : null,
    },
  });
  await recalcularProgressoEtapa(d.etapaId);
  await registrar(status === "CONCLUIDA" ? "CONCLUIU" : "EDITOU", "Sub-etapa", d.titulo, obraId);
  revalidatePath(`/obras/${obraId}`);
}

/** Alterna rapidamente o status de uma sub-etapa (Pendente ↔ Concluída). */
export async function alternarSubEtapa(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const obraId = String(formData.get("obraId"));
  const sub = await prisma.subEtapa.findUnique({ where: { id } });
  if (!sub) return;
  const novo = sub.status === "CONCLUIDA" ? "PENDENTE" : "CONCLUIDA";
  await prisma.subEtapa.update({
    where: { id },
    data: { status: novo, concluidaEm: novo === "CONCLUIDA" ? new Date() : null },
  });
  await recalcularProgressoEtapa(sub.etapaId);
  await registrar(
    novo === "CONCLUIDA" ? "CONCLUIU" : "EDITOU",
    "Sub-etapa",
    `${sub.titulo} (${novo === "CONCLUIDA" ? "concluída" : "reaberta"})`,
    obraId
  );
  revalidatePath(`/obras/${obraId}`);
}

export async function excluirSubEtapa(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const obraId = String(formData.get("obraId"));
  const sub = await prisma.subEtapa.findUnique({ where: { id } });
  await prisma.subEtapa.delete({ where: { id } });
  if (sub) {
    await recalcularProgressoEtapa(sub.etapaId);
    await registrar("EXCLUIU", "Sub-etapa", sub.titulo, obraId);
  }
  revalidatePath(`/obras/${obraId}`);
}
