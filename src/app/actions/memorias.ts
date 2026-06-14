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
  return session.user;
}

const schema = z.object({
  conteudo: z.string().trim().min(3, "Escreva o que a IA deve lembrar.").max(500),
});

/** Cria uma memória manual (origem MANUAL). */
export async function criarMemoria(formData: FormData) {
  const user = await exigirAdmin();
  const { conteudo } = schema.parse({ conteudo: formData.get("conteudo") });
  await prisma.memoriaIA.create({
    data: { conteudo, origem: "MANUAL", criadoPorNome: user.name ?? "Admin" },
  });
  await registrar("CRIOU", "Memória IA", conteudo);
  revalidatePath("/configuracoes");
}

/** Edita o conteúdo de uma memória existente. */
export async function atualizarMemoria(formData: FormData) {
  await exigirAdmin();
  const id = String(formData.get("id"));
  const { conteudo } = schema.parse({ conteudo: formData.get("conteudo") });
  await prisma.memoriaIA.update({ where: { id }, data: { conteudo } });
  await registrar("EDITOU", "Memória IA", conteudo, id);
  revalidatePath("/configuracoes");
}

/** Remove uma memória. */
export async function excluirMemoria(formData: FormData) {
  await exigirAdmin();
  const id = String(formData.get("id"));
  const mem = await prisma.memoriaIA.findUnique({ where: { id } });
  await prisma.memoriaIA.delete({ where: { id } });
  await registrar("EXCLUIU", "Memória IA", mem?.conteudo ?? "", id);
  revalidatePath("/configuracoes");
}
