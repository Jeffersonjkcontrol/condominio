// Lógica de Eventos (agenda + reserva de espaços comuns).

export const TIPOS_EVENTO = [
  "Assembleia",
  "Reunião",
  "Confraternização",
  "Manutenção",
  "Dedetização",
  "Reserva",
  "Aviso",
  "Outro",
] as const;

export const LOCAIS_EVENTO = [
  "Salão de festas",
  "Churrasqueira",
  "Quadra",
  "Piscina",
  "Espaço gourmet",
  "Playground",
  "Área comum",
  "Outro",
] as const;

/**
 * Status calculado do evento por data:
 * - Cancelado: manual.
 * - Em andamento: agora está entre início e fim.
 * - Concluído: já passou do fim.
 * - Agendado: ainda vai começar.
 */
export function statusCalculadoEvento(
  statusManual: string,
  dataInicio: Date | string,
  dataFim: Date | string,
  hoje = new Date()
): "AGENDADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO" {
  if (statusManual === "CANCELADO") return "CANCELADO";
  const ini = new Date(dataInicio);
  const fim = new Date(dataFim);
  if (hoje > fim) return "CONCLUIDO";
  if (hoje >= ini && hoje <= fim) return "EM_ANDAMENTO";
  return "AGENDADO";
}

export const STATUS_EVENTO_LABEL: Record<string, string> = {
  AGENDADO: "Agendado",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const STATUS_EVENTO_TONE: Record<
  string,
  "default" | "info" | "success" | "danger" | "warning"
> = {
  AGENDADO: "info",
  EM_ANDAMENTO: "warning",
  CONCLUIDO: "success",
  CANCELADO: "default",
};
