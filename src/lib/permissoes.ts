import type { Papel } from "@prisma/client";

/**
 * Modelo de permissões (RBAC).
 * - USUARIO: somente leitura.
 * - GESTOR: cria/edita recibos, fornecedores, serviços e obras.
 * - ADMIN (síndico): tudo + gestão de usuários.
 */
export const PAPEL_LABEL: Record<Papel, string> = {
  ADMIN: "Síndico / Admin",
  GESTOR: "Gestor",
  USUARIO: "Usuário",
};

export function podeEditar(papel: Papel | undefined | null): boolean {
  return papel === "ADMIN" || papel === "GESTOR";
}

export function ehAdmin(papel: Papel | undefined | null): boolean {
  return papel === "ADMIN";
}

/** Acesso ao Assistente IA: Admin sempre; demais usuários conforme liberação do admin. */
export function podeUsarAssistente(
  papel: Papel | undefined | null,
  podeUsarIA: boolean | undefined | null
): boolean {
  return papel === "ADMIN" || Boolean(podeUsarIA);
}
