// Lógica de Manutenção (Ordens de Serviço e Sub-OS).

/** Tipos de manutenção interna (classificação da OS). */
export const TIPOS_MANUTENCAO = [
  "Jardinagem",
  "Elétrica",
  "Hidráulica",
  "Pintura",
  "Alvenaria",
  "Limpeza",
  "Elevador",
  "Equipamentos",
  "Estrutural",
  "Geral",
  "Outros",
] as const;

export type SubOSLike = { status: string };

/**
 * Status calculado da OS:
 * - Cancelada: manual.
 * - Concluída: manual OU todas as sub-OS concluídas.
 * - Atrasada: passou da data prevista e não foi concluída/cancelada.
 * - Caso contrário: o status manual (Aberta / Em andamento).
 */
export function statusCalculadoOS(
  statusManual: string,
  dataPrevista: Date | string | null | undefined,
  subOrdens: SubOSLike[],
  hoje = new Date()
): "ABERTA" | "EM_ANDAMENTO" | "CONCLUIDA" | "ATRASADA" | "CANCELADA" {
  if (statusManual === "CANCELADA") return "CANCELADA";

  const todasConcluidas =
    subOrdens.length > 0 && subOrdens.every((s) => s.status === "CONCLUIDA");
  if (statusManual === "CONCLUIDA" || todasConcluidas) return "CONCLUIDA";

  if (dataPrevista && hoje > new Date(dataPrevista)) return "ATRASADA";

  return statusManual === "EM_ANDAMENTO" ? "EM_ANDAMENTO" : "ABERTA";
}

/** Progresso da OS pela proporção de sub-OS concluídas (0-100). */
export function progressoOS(subOrdens: SubOSLike[]): number {
  if (subOrdens.length === 0) return 0;
  const feitas = subOrdens.filter((s) => s.status === "CONCLUIDA").length;
  return Math.round((feitas / subOrdens.length) * 100);
}

export const STATUS_OS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  ATRASADA: "Atrasada",
  CANCELADA: "Cancelada",
};

export const STATUS_OS_TONE: Record<
  string,
  "default" | "info" | "success" | "danger" | "warning"
> = {
  ABERTA: "info",
  EM_ANDAMENTO: "warning",
  CONCLUIDA: "success",
  ATRASADA: "danger",
  CANCELADA: "default",
};

export const PRIORIDADE_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const PRIORIDADE_TONE: Record<
  string,
  "default" | "info" | "success" | "danger" | "warning"
> = {
  BAIXA: "default",
  MEDIA: "info",
  ALTA: "warning",
  URGENTE: "danger",
};

export const STATUS_SUBOS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};

export const STATUS_SUBOS_TONE: Record<
  string,
  "default" | "info" | "success" | "danger" | "warning"
> = {
  PENDENTE: "default",
  EM_ANDAMENTO: "warning",
  CONCLUIDA: "success",
};
