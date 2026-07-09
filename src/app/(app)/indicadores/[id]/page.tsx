import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gauge, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buscarIndicadores, buscarHistorico } from "@/lib/nexus";
import { SensorChart } from "@/components/sensor-chart";
import { formatarDataHora, cn } from "@/lib/utils";
import type { SP } from "@/lib/listagem";

const PERIODOS = [
  { horas: 24, rotulo: "24 horas" },
  { horas: 48, rotulo: "48 horas" },
  { horas: 168, rotulo: "7 dias" },
] as const;

function fmt(v: number | string | null): string {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
  return String(v);
}

export default async function IndicadorDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const horasBruto = Number(Array.isArray(sp.horas) ? sp.horas[0] : sp.horas);
  const horas = PERIODOS.some((p) => p.horas === horasBruto) ? horasBruto : 24;

  const indicador = await prisma.indicadorExterno.findUnique({ where: { id } });
  if (!indicador) notFound();

  const [leituras, historico] = await Promise.all([
    buscarIndicadores(),
    buscarHistorico(indicador.deviceLabel, indicador.variableLabel, horas),
  ]);
  const atual = leituras.find((l) => l.id === id);

  const valores = historico.pontos.map((p) => p.v);
  const temDados = valores.length > 0;
  const minimo = temDados ? Math.min(...valores) : null;
  const maximo = temDados ? Math.max(...valores) : null;
  const media = temDados ? valores.reduce((s, v) => s + v, 0) / valores.length : null;
  const un = indicador.unidade ? ` ${indicador.unidade}` : "";

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${
            atual?.erro ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"
          }`}
        >
          {atual?.erro ? <AlertTriangle className="h-6 w-6" /> : <Gauge className="h-6 w-6" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{indicador.nome}</h1>
          {atual?.erro ? (
            <p className="text-sm font-medium text-warning">Indisponível — {atual.erro}</p>
          ) : (
            <p className="text-sm text-muted">
              Agora: <span className="text-lg font-bold text-foreground">{fmt(atual?.valor ?? null)}{un}</span>
              {atual?.timestamp ? ` · leitura em ${formatarDataHora(atual.timestamp)}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Seletor de período */}
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.horas}
            href={`/indicadores/${indicador.id}?horas=${p.horas}`}
            className={cn(
              "inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium transition-colors",
              p.horas === horas
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground"
            )}
          >
            {p.rotulo}
          </Link>
        ))}
      </div>

      {/* Mín / Máx / Média da janela */}
      {temDados && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent>
              <p className="text-sm text-muted">Mínimo</p>
              <p className="text-xl font-bold text-foreground">{fmt(minimo)}{un}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted">Máximo</p>
              <p className="text-xl font-bold text-foreground">{fmt(maximo)}{un}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted">Média</p>
              <p className="text-xl font-bold text-foreground">{fmt(media)}{un}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Histórico — {PERIODOS.find((p) => p.horas === horas)?.rotulo}
            {historico.total > 0 && (
              <span className="ml-2 text-sm font-normal text-muted">
                {historico.total} leitura(s)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SensorChart pontos={historico.pontos} unidade={indicador.unidade} longo={horas > 48} />
        </CardContent>
      </Card>
    </div>
  );
}
