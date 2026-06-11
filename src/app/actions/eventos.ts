"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";
import { formatarDataHora } from "@/lib/utils";

async function exigirGestor() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (!podeEditar(session.user.papel)) throw new Error("Sem permissão.");
  return session;
}

const schema = z
  .object({
    titulo: z.string().min(1, "Informe o título."),
    tipo: z.string().optional(),
    local: z.string().optional(),
    descricao: z.string().optional(),
    dataInicio: z.string().min(1, "Informe o início."),
    dataFim: z.string().min(1, "Informe o término."),
    reservante: z.string().optional(),
    responsavelId: z.string().optional(),
    cancelado: z.boolean().optional(),
  })
  .refine((d) => new Date(d.dataFim) >= new Date(d.dataInicio), {
    message: "O término deve ser depois do início.",
    path: ["dataFim"],
  });

function ler(formData: FormData) {
  return schema.parse({
    titulo: formData.get("titulo"),
    tipo: formData.get("tipo") || undefined,
    local: formData.get("local") || undefined,
    descricao: formData.get("descricao") || undefined,
    dataInicio: formData.get("dataInicio"),
    dataFim: formData.get("dataFim"),
    reservante: formData.get("reservante") || undefined,
    responsavelId: formData.get("responsavelId") || undefined,
    cancelado: formData.get("cancelado") === "on",
  });
}

/** Bloqueia sobreposição de horário no MESMO local (reserva de espaço). */
async function checarConflito(
  local: string | undefined,
  inicio: Date,
  fim: Date,
  cancelado: boolean,
  ignorarId?: string
) {
  if (!local || cancelado) return;
  const conflito = await prisma.evento.findFirst({
    where: {
      local,
      status: { not: "CANCELADO" },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
      dataInicio: { lt: fim },
      dataFim: { gt: inicio },
    },
  });
  if (conflito) {
    throw new Error(
      `Conflito de reserva em "${local}": já existe "${conflito.titulo}" de ${formatarDataHora(
        conflito.dataInicio
      )} a ${formatarDataHora(conflito.dataFim)}.`
    );
  }
}

export async function criarEvento(formData: FormData) {
  const session = await exigirGestor();
  const d = ler(formData);
  const inicio = new Date(d.dataInicio);
  const fim = new Date(d.dataFim);
  await checarConflito(d.local, inicio, fim, d.cancelado ?? false);

  const evento = await prisma.evento.create({
    data: {
      titulo: d.titulo,
      tipo: d.tipo ?? "Outro",
      local: d.local || null,
      descricao: d.descricao,
      dataInicio: inicio,
      dataFim: fim,
      reservante: d.reservante,
      status: d.cancelado ? "CANCELADO" : "AGENDADO",
      responsavelId: d.responsavelId || null,
      criadoPorId: session.user.id,
    },
  });
  await registrar("CRIOU", "Evento", `${d.titulo} (${d.tipo ?? "Outro"})`, evento.id);
  revalidatePath("/eventos");
}

export async function atualizarEvento(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const d = ler(formData);
  const inicio = new Date(d.dataInicio);
  const fim = new Date(d.dataFim);
  await checarConflito(d.local, inicio, fim, d.cancelado ?? false, id);

  await prisma.evento.update({
    where: { id },
    data: {
      titulo: d.titulo,
      tipo: d.tipo ?? "Outro",
      local: d.local || null,
      descricao: d.descricao,
      dataInicio: inicio,
      dataFim: fim,
      reservante: d.reservante,
      status: d.cancelado ? "CANCELADO" : "AGENDADO",
      responsavelId: d.responsavelId || null,
    },
  });
  await registrar("EDITOU", "Evento", `${d.titulo}${d.cancelado ? " (cancelado)" : ""}`, id);
  revalidatePath("/eventos");
}

export async function excluirEvento(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const e = await prisma.evento.findUnique({ where: { id } });
  await prisma.evento.delete({ where: { id } });
  if (e) await registrar("EXCLUIU", "Evento", e.titulo, id);
  revalidatePath("/eventos");
}
