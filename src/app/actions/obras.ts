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
