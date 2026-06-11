"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";
import { gerarRecorrenciasPendentes } from "@/lib/recorrencias";

async function exigirGestor() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (!podeEditar(session.user.papel)) throw new Error("Sem permissão.");
  return session;
}

const schema = z.object({
  descricao: z.string().min(1, "Informe a descrição."),
  categoria: z.string().min(1, "Informe a categoria."),
  valor: z.coerce.number().nonnegative("Valor inválido."),
  diaVencimento: z.coerce.number().min(1).max(28),
  fornecedorId: z.string().optional(),
  ativo: z.boolean().optional(),
});

function ler(formData: FormData) {
  return schema.parse({
    descricao: formData.get("descricao"),
    categoria: formData.get("categoria"),
    valor: formData.get("valor"),
    diaVencimento: formData.get("diaVencimento"),
    fornecedorId: formData.get("fornecedorId") || undefined,
    ativo: formData.get("ativo") === "on",
  });
}

export async function criarRecorrencia(formData: FormData) {
  const session = await exigirGestor();
  const d = ler(formData);
  await prisma.recorrencia.create({
    data: {
      descricao: d.descricao,
      categoria: d.categoria,
      valor: d.valor,
      diaVencimento: d.diaVencimento,
      ativo: d.ativo ?? true,
      fornecedorId: d.fornecedorId || null,
      criadoPorId: session.user.id,
    },
  });
  await registrar("CRIOU", "Conta fixa", `${d.descricao} (dia ${d.diaVencimento})`);
  // Já lança eventuais recibos vencidos imediatamente.
  await gerarRecorrenciasPendentes(true);
  revalidatePath("/recorrencias");
  revalidatePath("/recibos");
}

export async function atualizarRecorrencia(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const d = ler(formData);
  await prisma.recorrencia.update({
    where: { id },
    data: {
      descricao: d.descricao,
      categoria: d.categoria,
      valor: d.valor,
      diaVencimento: d.diaVencimento,
      ativo: d.ativo ?? false,
      fornecedorId: d.fornecedorId || null,
    },
  });
  await registrar("EDITOU", "Conta fixa", d.descricao, id);
  await gerarRecorrenciasPendentes(true);
  revalidatePath("/recorrencias");
  revalidatePath("/recibos");
}

export async function excluirRecorrencia(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const r = await prisma.recorrencia.findUnique({ where: { id } });
  await prisma.recorrencia.delete({ where: { id } });
  if (r) await registrar("EXCLUIU", "Conta fixa", r.descricao, id);
  revalidatePath("/recorrencias");
}
