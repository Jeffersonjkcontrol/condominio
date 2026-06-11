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
  nomeCondominio: z.string().min(1, "Informe o nome do condomínio."),
  claudeModelo: z.string().min(1),
  geminiModelo: z.string().min(1),
  openaiModelo: z.string().min(1),
  claudeApiKey: z.string().optional(),
  geminiApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  horasAvisoEvento: z.coerce.number().int().min(1).max(168),
});

export async function salvarConfiguracao(formData: FormData) {
  await exigirAdmin();
  const d = schema.parse({
    nomeCondominio: formData.get("nomeCondominio"),
    claudeModelo: formData.get("claudeModelo"),
    geminiModelo: formData.get("geminiModelo"),
    openaiModelo: formData.get("openaiModelo"),
    claudeApiKey: (formData.get("claudeApiKey") as string) || undefined,
    geminiApiKey: (formData.get("geminiApiKey") as string) || undefined,
    openaiApiKey: (formData.get("openaiApiKey") as string) || undefined,
    horasAvisoEvento: formData.get("horasAvisoEvento"),
  });

  // Chave só é atualizada se um novo valor for informado (campo em branco mantém a atual).
  const dados = {
    nomeCondominio: d.nomeCondominio,
    claudeModelo: d.claudeModelo,
    geminiModelo: d.geminiModelo,
    openaiModelo: d.openaiModelo,
    horasAvisoEvento: d.horasAvisoEvento,
    ...(d.claudeApiKey ? { claudeApiKey: d.claudeApiKey } : {}),
    ...(d.geminiApiKey ? { geminiApiKey: d.geminiApiKey } : {}),
    ...(d.openaiApiKey ? { openaiApiKey: d.openaiApiKey } : {}),
  };

  await prisma.configuracao.upsert({
    where: { id: "default" },
    update: dados,
    create: { id: "default", ...dados },
  });

  await registrar("EDITOU", "Configuração", `Nome do condomínio: ${d.nomeCondominio}`);
  revalidatePath("/configuracoes");
  revalidatePath("/", "layout");
}

/** Remove a chave de um provedor. */
export async function removerChave(formData: FormData) {
  await exigirAdmin();
  const provedor = String(formData.get("provedor"));
  const campo =
    provedor === "claude"
      ? "claudeApiKey"
      : provedor === "gemini"
      ? "geminiApiKey"
      : provedor === "openai"
      ? "openaiApiKey"
      : null;
  if (!campo) throw new Error("Provedor inválido.");

  await prisma.configuracao.update({
    where: { id: "default" },
    data: { [campo]: null },
  });
  await registrar("EDITOU", "Configuração", `Removeu a chave do ${provedor}`);
  revalidatePath("/configuracoes");
}
