"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { formatarVolume } from "@/lib/agua-calc";

export type BarraConsumo = {
  dia: string; // AAAA-MM-DD
  consumoLitros: number;
  consumoEstimadoLitros: number;
  cobertura: number; // 0–1
};

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const COBERTURA_MINIMA = 0.5; // abaixo disso o dia é marcado como incompleto

function rotuloDia(dia: string, comSemana = false): string {
  const [, m, d] = dia.split("-");
  if (!comSemana) return `${d}/${m}`;
  return `${SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()]}, ${d}/${m}`;
}

/** Consumo diário (uma barra por dia). Série única → cor primária do tema, sem legenda. */
export function ConsumoChart({ dias }: { dias: BarraConsumo[] }) {
  if (dias.length === 0)
    return <p className="py-12 text-center text-sm text-muted">Ainda sem dias processados.</p>;

  const usarM3 = Math.max(...dias.map((d) => d.consumoLitros)) >= 10_000;
  const fmtEixo = (v: number) =>
    usarM3 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m³` : `${Math.round(v)} L`;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dias} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} barCategoryGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="dia"
          tickFormatter={(d) => rotuloDia(String(d))}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          minTickGap={16}
        />
        <YAxis tickFormatter={(v) => fmtEixo(Number(v))} tick={{ fontSize: 11, fill: "var(--muted)" }} width={56} />
        <Tooltip
          cursor={{ fill: "var(--surface-muted)" }}
          labelFormatter={(d) => rotuloDia(String(d), true)}
          formatter={(_v, _n, item) => {
            const b = item.payload as BarraConsumo;
            const partes = [formatarVolume(b.consumoLitros)];
            if (b.consumoEstimadoLitros > 0)
              partes.push(`(inclui ~${formatarVolume(b.consumoEstimadoLitros)} estimados no enchimento)`);
            if (b.cobertura < COBERTURA_MINIMA)
              partes.push(`· dados incompletos (${Math.round(b.cobertura * 100)}% do dia)`);
            return [partes.join(" "), "Consumo"];
          }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--foreground)",
          }}
        />
        <Bar dataKey="consumoLitros" radius={[4, 4, 0, 0]}>
          {dias.map((d) => (
            <Cell
              key={d.dia}
              fill="var(--primary)"
              fillOpacity={d.cobertura < COBERTURA_MINIMA ? 0.35 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
