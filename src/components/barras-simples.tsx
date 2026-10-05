"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { formatarVolume } from "@/lib/agua-calc";

/** Barras simples de uma série (padrões de consumo). Formato por nome: funções não passam do servidor. */
export function BarrasSimples({
  dados,
  formato,
  altura = 220,
}: {
  dados: { rotulo: string; valor: number | null; destaque?: boolean }[];
  formato: "volume" | "vazao";
  altura?: number;
}) {
  const fmt = (v: number) => (formato === "vazao" ? `${formatarVolume(v)}/h` : formatarVolume(v));
  const usarM3 = Math.max(0, ...dados.map((d) => d.valor ?? 0)) >= 10_000;
  const eixo = (v: number) =>
    usarM3 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m³` : `${Math.round(v)} L`;

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap={3}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "var(--muted)" }} interval="preserveStartEnd" />
        <YAxis tickFormatter={(v) => eixo(Number(v))} tick={{ fontSize: 11, fill: "var(--muted)" }} width={56} />
        <Tooltip
          cursor={{ fill: "var(--surface-muted)" }}
          formatter={(v) => [v == null ? "sem dado" : fmt(Number(v)), formato === "vazao" ? "Média" : "Média diária"]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--foreground)",
          }}
        />
        <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
          {dados.map((d) => (
            <Cell key={d.rotulo} fill="var(--primary)" fillOpacity={d.destaque ? 1 : 0.75} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
