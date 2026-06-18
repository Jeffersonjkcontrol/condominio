import { diferencaDias } from "./utils";

export type EtapaLike = {
  fimPrev: Date | string;
  fimReal?: Date | string | null;
  progresso: number;
};

/** True se a obra deve ser considerada concluída (manual ou todas as etapas em 100%). */
export function obraConcluida(statusManual: string, etapas: EtapaLike[]): boolean {
  if (statusManual === "CONCLUIDA") return true;
  return etapas.length > 0 && etapas.every((e) => e.progresso >= 100);
}

/** Uma etapa está atrasada se já passou da data prevista e não foi concluída,
 *  ou se foi concluída depois do previsto. */
export function etapaAtrasada(etapa: EtapaLike, hoje = new Date()): boolean {
  const fimPrev = new Date(etapa.fimPrev);
  if (etapa.fimReal) {
    return new Date(etapa.fimReal) > fimPrev;
  }
  return hoje > fimPrev && etapa.progresso < 100;
}

/** Dias de atraso (0 se em dia). */
export function diasAtraso(etapa: EtapaLike, hoje = new Date()): number {
  if (!etapaAtrasada(etapa, hoje)) return 0;
  const fimPrev = new Date(etapa.fimPrev);
  const ref = etapa.fimReal ? new Date(etapa.fimReal) : hoje;
  return Math.max(0, diferencaDias(fimPrev, ref));
}

/**
 * Status calculado AUTOMATICAMENTE a partir das datas e do progresso:
 * - Concluída: manual OU todas as etapas em 100%.
 * - Planejada: hoje é antes do início previsto.
 * - Atrasada: passou do fim previsto (ou há etapa atrasada) e não foi concluída.
 * - Em andamento: está dentro do período previsto, no prazo.
 */
/** Progresso de uma etapa pela proporção de sub-etapas concluídas (0-100). */
export function progressoEtapa(subEtapas: { status: string }[]): number {
  if (subEtapas.length === 0) return 0;
  const feitas = subEtapas.filter((s) => s.status === "CONCLUIDA").length;
  return Math.round((feitas / subEtapas.length) * 100);
}

export function statusCalculadoObra(
  statusManual: string,
  inicioPrev: Date | string,
  fimPrev: Date | string,
  etapas: EtapaLike[],
  hoje = new Date()
): "PLANEJADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "ATRASADA" {
  if (obraConcluida(statusManual, etapas)) return "CONCLUIDA";

  const ini = new Date(inicioPrev);
  const fim = new Date(fimPrev);

  if (hoje < ini) return "PLANEJADA";

  const temAtraso = hoje > fim || etapas.some((e) => etapaAtrasada(e, hoje));
  if (temAtraso) return "ATRASADA";

  return "EM_ANDAMENTO";
}

/** Status automático de uma ETAPA, a partir das datas previstas e do progresso. */
export function statusCalculadoEtapa(
  etapa: {
    inicioPrev: Date | string;
    fimPrev: Date | string;
    fimReal?: Date | string | null;
    progresso: number;
  },
  hoje = new Date()
): "PLANEJADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "ATRASADA" {
  if (etapa.progresso >= 100) return "CONCLUIDA";
  if (hoje < new Date(etapa.inicioPrev)) return "PLANEJADA";
  if (etapaAtrasada(etapa, hoje)) return "ATRASADA";
  return "EM_ANDAMENTO";
}

export const STATUS_OBRA_LABEL: Record<string, string> = {
  PLANEJADA: "Planejada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  ATRASADA: "Atrasada",
};

export const STATUS_OBRA_TONE: Record<string, "default" | "info" | "success" | "danger" | "warning"> = {
  PLANEJADA: "default",
  EM_ANDAMENTO: "info",
  CONCLUIDA: "success",
  ATRASADA: "danger",
};
