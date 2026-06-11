import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export type AcaoAuditoria = "CRIOU" | "EDITOU" | "EXCLUIU" | "CONCLUIU";

/**
 * Registra uma ação no log de auditoria (rastreabilidade).
 * Captura automaticamente o usuário logado. Nunca lança erro que quebre a operação principal.
 */
export async function registrar(
  acao: AcaoAuditoria,
  entidade: string,
  detalhe: string,
  entidadeId?: string
) {
  try {
    const session = await auth();
    await prisma.auditoria.create({
      data: {
        usuarioId: session?.user?.id ?? null,
        usuarioNome: session?.user?.name ?? "Sistema",
        acao,
        entidade,
        detalhe,
        entidadeId: entidadeId ?? null,
      },
    });
  } catch (e) {
    console.error("Falha ao registrar auditoria:", e);
  }
}

export const ACAO_LABEL: Record<string, string> = {
  CRIOU: "Criou",
  EDITOU: "Editou",
  EXCLUIU: "Excluiu",
  CONCLUIU: "Concluiu",
};

export const ACAO_TONE: Record<string, "default" | "info" | "success" | "danger" | "warning"> = {
  CRIOU: "success",
  EDITOU: "info",
  EXCLUIU: "danger",
  CONCLUIU: "success",
};
