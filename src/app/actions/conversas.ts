"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeUsarAssistente } from "@/lib/permissoes";

async function exigirAcessoIA() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (!podeUsarAssistente(session.user.papel, session.user.podeUsarIA))
    throw new Error("Sem permissão.");
  return session;
}

export async function excluirConversa(formData: FormData) {
  const session = await exigirAcessoIA();
  const id = String(formData.get("id"));
  // Só exclui conversa do próprio usuário.
  await prisma.conversa.deleteMany({ where: { id, criadoPorId: session.user.id } });
  revalidatePath("/assistente");
  redirect("/assistente");
}
