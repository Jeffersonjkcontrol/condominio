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

// ---- Ordem de Serviço ----

const osSchema = z.object({
  titulo: z.string().min(1, "Informe o título."),
  tipo: z.string().optional(),
  descricao: z.string().optional(),
  local: z.string().optional(),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
  status: z.enum(["ABERTA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]).optional(),
  custo: z.coerce.number().optional(),
  dataPrevista: z.string().optional(),
  fornecedorId: z.string().optional(),
  responsavelId: z.string().optional(),
});

function lerOS(formData: FormData) {
  const custo = formData.get("custo");
  return osSchema.parse({
    titulo: formData.get("titulo"),
    tipo: formData.get("tipo") || undefined,
    descricao: formData.get("descricao") || undefined,
    local: formData.get("local") || undefined,
    prioridade: formData.get("prioridade") || undefined,
    status: formData.get("status") || undefined,
    custo: custo ? Number(custo) : undefined,
    dataPrevista: formData.get("dataPrevista") || undefined,
    fornecedorId: formData.get("fornecedorId") || undefined,
    responsavelId: formData.get("responsavelId") || undefined,
  });
}

export async function criarOS(formData: FormData) {
  const session = await exigirGestor();
  const d = lerOS(formData);
  const ultima = await prisma.ordemServico.findFirst({ orderBy: { numero: "desc" } });
  const numero = (ultima?.numero ?? 0) + 1;
  const status = d.status ?? "ABERTA";

  const os = await prisma.ordemServico.create({
    data: {
      numero,
      titulo: d.titulo,
      tipo: d.tipo ?? "Geral",
      descricao: d.descricao,
      local: d.local,
      prioridade: d.prioridade ?? "MEDIA",
      status,
      custo: d.custo,
      dataPrevista: d.dataPrevista ? new Date(d.dataPrevista) : null,
      dataConclusao: status === "CONCLUIDA" ? new Date() : null,
      fornecedorId: d.fornecedorId || null,
      responsavelId: d.responsavelId || null,
      criadoPorId: session.user.id,
    },
  });
  await registrar("CRIOU", "OS", `OS #${numero} (${d.tipo ?? "Geral"}) — ${d.titulo}`, os.id);
  revalidatePath("/manutencao");
}

export async function atualizarOS(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const d = lerOS(formData);
  const status = d.status ?? "ABERTA";

  const os = await prisma.ordemServico.update({
    where: { id },
    data: {
      titulo: d.titulo,
      tipo: d.tipo ?? "Geral",
      descricao: d.descricao,
      local: d.local,
      prioridade: d.prioridade ?? "MEDIA",
      status,
      custo: d.custo,
      dataPrevista: d.dataPrevista ? new Date(d.dataPrevista) : null,
      dataConclusao: status === "CONCLUIDA" ? new Date() : null,
      fornecedorId: d.fornecedorId || null,
      responsavelId: d.responsavelId || null,
    },
  });
  await registrar(
    status === "CONCLUIDA" ? "CONCLUIU" : "EDITOU",
    "OS",
    `OS #${os.numero} — ${d.titulo} (status: ${status})`,
    id
  );
  revalidatePath("/manutencao");
  revalidatePath(`/manutencao/${id}`);
}

export async function excluirOS(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const os = await prisma.ordemServico.findUnique({ where: { id } });
  await prisma.ordemServico.delete({ where: { id } });
  if (os) await registrar("EXCLUIU", "OS", `OS #${os.numero} — ${os.titulo}`, id);
  revalidatePath("/manutencao");
}

// ---- Sub-OS ----

const subSchema = z.object({
  ordemId: z.string().min(1),
  titulo: z.string().min(1, "Informe o título."),
  descricao: z.string().optional(),
  status: z.enum(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA"]).optional(),
  custo: z.coerce.number().optional(),
  ordem: z.coerce.number().optional(),
});

function lerSub(formData: FormData) {
  const custo = formData.get("custo");
  return subSchema.parse({
    ordemId: formData.get("ordemId"),
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || undefined,
    status: formData.get("status") || undefined,
    custo: custo ? Number(custo) : undefined,
    ordem: formData.get("ordem") ?? 0,
  });
}

export async function criarSubOS(formData: FormData) {
  await exigirGestor();
  const d = lerSub(formData);
  const status = d.status ?? "PENDENTE";
  await prisma.subOrdemServico.create({
    data: {
      ordemId: d.ordemId,
      titulo: d.titulo,
      descricao: d.descricao,
      status,
      custo: d.custo,
      ordem: d.ordem ?? 0,
      concluidaEm: status === "CONCLUIDA" ? new Date() : null,
    },
  });
  await registrar("CRIOU", "Sub-OS", d.titulo, d.ordemId);
  revalidatePath(`/manutencao/${d.ordemId}`);
}

export async function atualizarSubOS(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const d = lerSub(formData);
  const status = d.status ?? "PENDENTE";
  await prisma.subOrdemServico.update({
    where: { id },
    data: {
      titulo: d.titulo,
      descricao: d.descricao,
      status,
      custo: d.custo,
      ordem: d.ordem ?? 0,
      concluidaEm: status === "CONCLUIDA" ? new Date() : null,
    },
  });
  await registrar(status === "CONCLUIDA" ? "CONCLUIU" : "EDITOU", "Sub-OS", d.titulo, d.ordemId);
  revalidatePath(`/manutencao/${d.ordemId}`);
}

/** Alterna rapidamente o status de uma sub-OS (Pendente → Concluída e vice-versa). */
export async function alternarSubOS(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const ordemId = String(formData.get("ordemId"));
  const sub = await prisma.subOrdemServico.findUnique({ where: { id } });
  if (!sub) return;
  const novo = sub.status === "CONCLUIDA" ? "PENDENTE" : "CONCLUIDA";
  await prisma.subOrdemServico.update({
    where: { id },
    data: { status: novo, concluidaEm: novo === "CONCLUIDA" ? new Date() : null },
  });
  await registrar(
    novo === "CONCLUIDA" ? "CONCLUIU" : "EDITOU",
    "Sub-OS",
    `${sub.titulo} (${novo === "CONCLUIDA" ? "concluída" : "reaberta"})`,
    ordemId
  );
  revalidatePath(`/manutencao/${ordemId}`);
}

export async function excluirSubOS(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const ordemId = String(formData.get("ordemId"));
  const sub = await prisma.subOrdemServico.findUnique({ where: { id } });
  await prisma.subOrdemServico.delete({ where: { id } });
  if (sub) await registrar("EXCLUIU", "Sub-OS", sub.titulo, ordemId);
  revalidatePath(`/manutencao/${ordemId}`);
}
