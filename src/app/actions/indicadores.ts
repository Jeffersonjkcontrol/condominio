"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ehAdmin } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";

async function exigirAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (!ehAdmin(session.user.papel)) throw new Error("Sem permissão.");
}

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  deviceLabel: z.string().trim().min(1, "Informe o deviceLabel."),
  variableLabel: z.string().trim().min(1, "Informe o variableLabel."),
  unidade: z.string().trim().optional(),
  ordem: z.coerce.number().optional(),
});

function ler(formData: FormData) {
  return schema.parse({
    nome: formData.get("nome"),
    deviceLabel: formData.get("deviceLabel"),
    variableLabel: formData.get("variableLabel"),
    unidade: (formData.get("unidade") as string) || undefined,
    ordem: formData.get("ordem") ?? 0,
  });
}

function revalidar() {
  revalidatePath("/configuracoes");
  revalidatePath("/", "layout");
}

export async function criarIndicador(formData: FormData) {
  await exigirAdmin();
  const d = ler(formData);
  await prisma.indicadorExterno.create({
    data: {
      nome: d.nome,
      deviceLabel: d.deviceLabel,
      variableLabel: d.variableLabel,
      unidade: d.unidade,
      ordem: d.ordem ?? 0,
    },
  });
  await registrar("CRIOU", "Indicador externo", `${d.nome} (${d.deviceLabel}/${d.variableLabel})`);
  revalidar();
}

export async function atualizarIndicador(formData: FormData) {
  await exigirAdmin();
  const id = String(formData.get("id"));
  const d = ler(formData);
  await prisma.indicadorExterno.update({
    where: { id },
    data: {
      nome: d.nome,
      deviceLabel: d.deviceLabel,
      variableLabel: d.variableLabel,
      unidade: d.unidade,
      ordem: d.ordem ?? 0,
      ativo: formData.get("ativo") === "on",
    },
  });
  await registrar("EDITOU", "Indicador externo", d.nome, id);
  revalidar();
}

export async function excluirIndicador(formData: FormData) {
  await exigirAdmin();
  const id = String(formData.get("id"));
  const ind = await prisma.indicadorExterno.findUnique({ where: { id } });
  await prisma.indicadorExterno.delete({ where: { id } });
  if (ind) await registrar("EXCLUIU", "Indicador externo", ind.nome, id);
  revalidar();
}
