"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

const fornecedorSchema = z.object({
  nome: z.string().min(1, "Informe o nome."),
  cnpjCpf: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  endereco: z.string().optional(),
  observacoes: z.string().optional(),
});

function lerFornecedor(formData: FormData) {
  return fornecedorSchema.parse({
    nome: formData.get("nome"),
    cnpjCpf: formData.get("cnpjCpf") || undefined,
    telefone: formData.get("telefone") || undefined,
    email: formData.get("email") || undefined,
    endereco: formData.get("endereco") || undefined,
    observacoes: formData.get("observacoes") || undefined,
  });
}

export async function criarFornecedor(formData: FormData) {
  await exigirGestor();
  const dados = lerFornecedor(formData);
  const f = await prisma.fornecedor.create({ data: dados });
  await registrar("CRIOU", "Fornecedor", dados.nome, f.id);
  revalidatePath("/fornecedores");
}

export async function atualizarFornecedor(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const dados = lerFornecedor(formData);
  await prisma.fornecedor.update({ where: { id }, data: dados });
  await registrar("EDITOU", "Fornecedor", dados.nome, id);
  revalidatePath("/fornecedores");
  revalidatePath(`/fornecedores/${id}`);
}

export async function excluirFornecedor(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const f = await prisma.fornecedor.findUnique({ where: { id } });
  await prisma.fornecedor.delete({ where: { id } });
  if (f) await registrar("EXCLUIU", "Fornecedor", f.nome, id);
  revalidatePath("/fornecedores");
}

// ---- Serviços ----

const servicoSchema = z.object({
  fornecedorId: z.string().min(1),
  nome: z.string().min(1, "Informe o nome do serviço."),
  descricao: z.string().optional(),
  valorPadrao: z.coerce.number().optional(),
  unidade: z.string().optional(),
});

function lerServico(formData: FormData) {
  const valorRaw = formData.get("valorPadrao");
  return servicoSchema.parse({
    fornecedorId: formData.get("fornecedorId"),
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    valorPadrao: valorRaw ? Number(valorRaw) : undefined,
    unidade: formData.get("unidade") || undefined,
  });
}

export async function criarServico(formData: FormData) {
  await exigirGestor();
  const dados = lerServico(formData);
  const s = await prisma.servico.create({ data: dados });
  await registrar("CRIOU", "Serviço", dados.nome, s.id);
  revalidatePath("/servicos");
  revalidatePath(`/fornecedores/${dados.fornecedorId}`);
}

export async function atualizarServico(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const dados = lerServico(formData);
  await prisma.servico.update({ where: { id }, data: dados });
  await registrar("EDITOU", "Serviço", dados.nome, id);
  revalidatePath("/servicos");
  revalidatePath(`/fornecedores/${dados.fornecedorId}`);
}

export async function excluirServico(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const s = await prisma.servico.findUnique({ where: { id } });
  await prisma.servico.delete({ where: { id } });
  if (s) {
    await registrar("EXCLUIU", "Serviço", s.nome, id);
    revalidatePath(`/fornecedores/${s.fornecedorId}`);
  }
  revalidatePath("/servicos");
  if (formData.get("redirecionar")) redirect("/servicos");
}
