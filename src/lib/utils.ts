import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export function formatarData(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

export function formatarDataHora(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/** Converte Date para o valor de um <input type="date"> (yyyy-mm-dd) */
export function paraInputDate(data: Date | string | null | undefined): string {
  if (!data) return "";
  const d = typeof data === "string" ? new Date(data) : data;
  return d.toISOString().slice(0, 10);
}

/** Dias de diferença entre duas datas (b - a), ignorando horas */
export function diferencaDias(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / ms);
}
