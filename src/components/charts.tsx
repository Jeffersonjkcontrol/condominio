"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { formatarMoeda } from "@/lib/utils";

const CORES = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

type Ponto = { nome: string; valor: number };

export function GastosPorCategoria({ dados }: { dados: Ponto[] }) {
  if (dados.length === 0)
    return <p className="py-12 text-center text-sm text-muted">Sem dados.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "var(--muted)" }} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} width={48} />
        <Tooltip
          formatter={(v) => formatarMoeda(Number(v))}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--foreground)",
          }}
        />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
          {dados.map((_, i) => (
            <Cell key={i} fill={CORES[i % CORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GastosPorMes({ dados }: { dados: Ponto[] }) {
  if (dados.length === 0)
    return <p className="py-12 text-center text-sm text-muted">Sem dados.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "var(--muted)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} width={48} />
        <Tooltip
          formatter={(v) => formatarMoeda(Number(v))}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--foreground)",
          }}
        />
        <Bar dataKey="valor" fill="#2563eb" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
