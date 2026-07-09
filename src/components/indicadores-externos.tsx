"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gauge, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type Leitura = {
  id: string;
  nome: string;
  unidade: string | null;
  valor: number | string | null;
  timestamp: string | null;
  erro: string | null;
};

function formatarValor(v: number | string | null): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
  }
  return String(v);
}

function quando(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IndicadoresExternos({ iniciais }: { iniciais: Leitura[] }) {
  const [dados, setDados] = useState<Leitura[]>(iniciais);

  useEffect(() => {
    let vivo = true;
    async function atualizar() {
      try {
        const r = await fetch("/api/indicadores", { cache: "no-store" });
        if (r.ok && vivo) setDados(await r.json());
      } catch {
        /* mantém o último valor */
      }
    }
    const t = setInterval(atualizar, 30000); // ao vivo: atualiza a cada 30s
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  if (dados.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {dados.map((d) => {
        const q = quando(d.timestamp);
        return (
          <Link
            key={d.id}
            href={`/indicadores/${d.id}`}
            title="Abrir e ver histórico"
            className="group block"
          >
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  d.erro ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"
                }`}
              >
                {d.erro ? <AlertTriangle className="h-6 w-6" /> : <Gauge className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted">{d.nome}</p>
                {d.erro ? (
                  <p className="text-sm font-medium text-warning">Indisponível</p>
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {formatarValor(d.valor)}
                    {d.unidade ? <span className="ml-1 text-base font-medium text-muted">{d.unidade}</span> : null}
                  </p>
                )}
                <p className="text-xs text-muted">
                  {d.erro ? d.erro : q ? `atualizado em ${q}` : "ao vivo"}
                </p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
