"use server";

import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";
import { formatarMoeda } from "@/lib/utils";

async function exigirGestor() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (!podeEditar(session.user.papel)) throw new Error("Sem permissão.");
  return session;
}

const reciboSchema = z.object({
  categoria: z.string().min(1, "Informe a categoria."),
  descricao: z.string().optional(),
  valor: z.coerce.number().nonnegative("Valor inválido."),
  dataEmissao: z.string().min(1, "Informe a data."),
  fornecedorId: z.string().optional(),
  obraId: z.string().optional(),
  recorrenciaId: z.string().optional(),
  status: z.enum(["PENDENTE", "CONFERIDO"]).optional(),
  textoExtraido: z.string().optional(),
  dadosExtraidos: z.string().optional(),
});

/** Ao vincular um recibo a uma conta fixa, atualiza o valor estimado dela com o valor real do recibo. */
async function sincronizarContaFixa(recorrenciaId: string | undefined, valor: number) {
  if (!recorrenciaId) return;
  await prisma.recorrencia.update({ where: { id: recorrenciaId }, data: { valor } });
  revalidatePath("/recorrencias");
}

// Apenas PDF e imagens. A extensão é derivada do TIPO do arquivo (não do nome enviado),
// evitando que se sirva HTML/SVG malicioso a partir de /uploads (XSS armazenado).
const TIPOS_RECIBO: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_ARQUIVO_RECIBO = 15 * 1024 * 1024; // 15 MB

async function salvarArquivo(arquivo: File | null): Promise<string | null> {
  if (!arquivo || arquivo.size === 0) return null;
  const ext = TIPOS_RECIBO[arquivo.type];
  if (!ext) {
    throw new Error("Arquivo inválido. Envie um PDF ou imagem (JPG, PNG ou WEBP).");
  }
  if (arquivo.size > MAX_ARQUIVO_RECIBO) {
    throw new Error("Arquivo muito grande (máximo 15 MB).");
  }
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const nome = `${randomUUID()}${ext}`;
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  await writeFile(path.join(dir, nome), bytes);
  return `/uploads/${nome}`;
}

export async function criarRecibo(formData: FormData) {
  const session = await exigirGestor();
  const dados = reciboSchema.parse({
    categoria: formData.get("categoria"),
    descricao: formData.get("descricao") || undefined,
    valor: formData.get("valor"),
    dataEmissao: formData.get("dataEmissao"),
    fornecedorId: formData.get("fornecedorId") || undefined,
    obraId: formData.get("obraId") || undefined,
    recorrenciaId: formData.get("recorrenciaId") || undefined,
    status: formData.get("status") || undefined,
    textoExtraido: formData.get("textoExtraido") || undefined,
    dadosExtraidos: formData.get("dadosExtraidos") || undefined,
  });

  const arquivoUrl = await salvarArquivo(formData.get("arquivo") as File | null);

  const novo = await prisma.recibo.create({
    data: {
      categoria: dados.categoria,
      descricao: dados.descricao,
      valor: dados.valor,
      dataEmissao: new Date(dados.dataEmissao),
      fornecedorId: dados.fornecedorId || null,
      obraId: dados.obraId || null,
      recorrenciaId: dados.recorrenciaId || null,
      status: dados.status ?? "PENDENTE",
      textoExtraido: dados.textoExtraido,
      dadosExtraidos: dados.dadosExtraidos,
      arquivoUrl,
      criadoPorId: session.user.id,
    },
  });
  await registrar("CRIOU", "Recibo", `${dados.categoria} — ${formatarMoeda(dados.valor)}`, novo.id);
  await sincronizarContaFixa(dados.recorrenciaId, dados.valor);
  revalidatePath("/recibos");
  if (dados.obraId) revalidatePath(`/obras/${dados.obraId}`);
}

export async function atualizarRecibo(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const dados = reciboSchema.parse({
    categoria: formData.get("categoria"),
    descricao: formData.get("descricao") || undefined,
    valor: formData.get("valor"),
    dataEmissao: formData.get("dataEmissao"),
    fornecedorId: formData.get("fornecedorId") || undefined,
    obraId: formData.get("obraId") || undefined,
    recorrenciaId: formData.get("recorrenciaId") || undefined,
    status: formData.get("status") || undefined,
  });

  const arquivo = formData.get("arquivo") as File | null;
  const arquivoUrl = await salvarArquivo(arquivo);

  await prisma.recibo.update({
    where: { id },
    data: {
      categoria: dados.categoria,
      descricao: dados.descricao,
      valor: dados.valor,
      dataEmissao: new Date(dados.dataEmissao),
      fornecedorId: dados.fornecedorId || null,
      obraId: dados.obraId || null,
      recorrenciaId: dados.recorrenciaId || null,
      status: dados.status ?? "PENDENTE",
      ...(arquivoUrl ? { arquivoUrl } : {}),
    },
  });
  await registrar("EDITOU", "Recibo", `${dados.categoria} — ${formatarMoeda(dados.valor)}`, id);
  await sincronizarContaFixa(dados.recorrenciaId, dados.valor);
  revalidatePath("/recibos");
  revalidatePath("/obras");
  if (dados.obraId) revalidatePath(`/obras/${dados.obraId}`);
}

export async function excluirRecibo(formData: FormData) {
  await exigirGestor();
  const id = String(formData.get("id"));
  const r = await prisma.recibo.findUnique({ where: { id } });
  await prisma.recibo.delete({ where: { id } });
  if (r) await registrar("EXCLUIU", "Recibo", `${r.categoria} — ${formatarMoeda(r.valor)}`, id);
  revalidatePath("/recibos");
}
