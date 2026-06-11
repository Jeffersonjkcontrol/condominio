"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ehAdmin } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";

async function exigirAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (!ehAdmin(session.user.papel)) throw new Error("Sem permissão.");
  return session;
}

const criarSchema = z.object({
  nome: z.string().min(1, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  papel: z.enum(["ADMIN", "GESTOR", "USUARIO"]),
  recebeNotificacoes: z.boolean().optional(),
  podeUsarIA: z.boolean().optional(),
});

export async function criarUsuario(formData: FormData) {
  await exigirAdmin();
  const d = criarSchema.parse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    senha: formData.get("senha"),
    papel: formData.get("papel"),
    recebeNotificacoes: formData.get("recebeNotificacoes") === "on",
    podeUsarIA: formData.get("podeUsarIA") === "on",
  });

  const existe = await prisma.user.findUnique({ where: { email: d.email } });
  if (existe) throw new Error("Já existe um usuário com este e-mail.");

  const u = await prisma.user.create({
    data: {
      nome: d.nome,
      email: d.email,
      senhaHash: await bcrypt.hash(d.senha, 10),
      papel: d.papel,
      recebeNotificacoes: d.recebeNotificacoes ?? false,
      podeUsarIA: d.podeUsarIA ?? false,
    },
  });
  await registrar("CRIOU", "Usuário", `${d.nome} (${d.papel})`, u.id);
  revalidatePath("/usuarios");
}

const atualizarSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  email: z.string().email(),
  papel: z.enum(["ADMIN", "GESTOR", "USUARIO"]),
  ativo: z.string().optional(),
  senha: z.string().optional(),
  recebeNotificacoes: z.boolean().optional(),
  podeUsarIA: z.boolean().optional(),
});

export async function atualizarUsuario(formData: FormData) {
  await exigirAdmin();
  const d = atualizarSchema.parse({
    id: formData.get("id"),
    nome: formData.get("nome"),
    email: formData.get("email"),
    papel: formData.get("papel"),
    ativo: formData.get("ativo") || undefined,
    senha: formData.get("senha") || undefined,
    recebeNotificacoes: formData.get("recebeNotificacoes") === "on",
    podeUsarIA: formData.get("podeUsarIA") === "on",
  });

  const dataUpdate: {
    nome: string;
    email: string;
    papel: "ADMIN" | "GESTOR" | "USUARIO";
    ativo: boolean;
    recebeNotificacoes: boolean;
    podeUsarIA: boolean;
    senhaHash?: string;
  } = {
    nome: d.nome,
    email: d.email,
    papel: d.papel,
    ativo: d.ativo === "on" || d.ativo === "true",
    recebeNotificacoes: d.recebeNotificacoes ?? false,
    podeUsarIA: d.podeUsarIA ?? false,
  };
  if (d.senha && d.senha.length >= 6) {
    dataUpdate.senhaHash = await bcrypt.hash(d.senha, 10);
  }

  await prisma.user.update({ where: { id: d.id }, data: dataUpdate });
  await registrar("EDITOU", "Usuário", `${d.nome} (${d.papel})`, d.id);
  revalidatePath("/usuarios");
}

export async function excluirUsuario(formData: FormData) {
  const session = await exigirAdmin();
  const id = String(formData.get("id"));
  if (id === session.user.id) {
    throw new Error("Você não pode excluir o próprio usuário.");
  }
  const u = await prisma.user.findUnique({ where: { id } });
  await prisma.user.delete({ where: { id } });
  if (u) await registrar("EXCLUIU", "Usuário", u.nome, id);
  revalidatePath("/usuarios");
}
