"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export type PontoGrafico = { t: string; v: number };

function fmtValor(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
}

/** Série temporal de um sensor (única série → cor primária do tema, sem legenda). */
export function SensorChart({
  pontos,
  unidade,
  longo = false,
}: {
  pontos: PontoGrafico[];
  unidade: string | null;
  /** true para janelas > 48h: eixo mostra dia + hora */
  longo?: boolean;
}) {
  if (pontos.length === 0)
    return <p className="py-12 text-center text-sm text-muted">Sem leituras no período.</p>;

  const dados = pontos.map((p) => ({ ms: new Date(p.t).getTime(), v: p.v }));

  const fmtEixo = (ms: number) => {
    const d = new Date(ms);
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (!longo) return hora;
    return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="ms"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={fmtEixo}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          minTickGap={48}
        />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(v) => fmtValor(Number(v))}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          width={48}
        />
        <Tooltip
          labelFormatter={(ms) =>
            new Date(Number(ms)).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          }
          formatter={(v) => [`${fmtValor(Number(v))}${unidade ? ` ${unidade}` : ""}`, "Leitura"]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--foreground)",
          }}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="var(--primary)"
          fillOpacity={0.12}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
