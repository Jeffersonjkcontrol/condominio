"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function marcarLida(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = String(formData.get("id"));
  const link = formData.get("link") ? String(formData.get("link")) : null;
  // só marca a própria notificação
  await prisma.notificacao.updateMany({
    where: { id, usuarioId: session.user.id },
    data: { lida: true },
  });
  revalidatePath("/", "layout");
  if (link) redirect(link);
}

export async function marcarTodasLidas() {
  const session = await auth();
  if (!session?.user) return;
  await prisma.notificacao.updateMany({
    where: { usuarioId: session.user.id, lida: false },
    data: { lida: true },
  });
  revalidatePath("/", "layout");
}
