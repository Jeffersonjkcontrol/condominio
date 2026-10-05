import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gauge, AlertTriangle, Droplets } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ehAdmin } from "@/lib/permissoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buscarIndicadores, buscarHistorico } from "@/lib/nexus";
import { historicoConsumo, consumoDeHoje, historicoEmDia } from "@/lib/agua";
import { calculaConsumo, formatarVolume, diaConfiavel } from "@/lib/agua-calc";
import { recalcularConsumo } from "@/app/actions/indicadores";
import { SensorChart } from "@/components/sensor-chart";
import { ConsumoChart } from "@/components/consumo-chart";
import { formatarDataHoraBR, cn } from "@/lib/utils";
import type { SP } from "@/lib/listagem";

const DIAS_GRAFICO = 30;
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function rotuloDia(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()]}, ${d}/${m}`;
}

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

  const temConsumo = calculaConsumo(indicador.tipo);
  const [leituras, historico, dias, hoje, emDia, session] = await Promise.all([
    buscarIndicadores(),
    buscarHistorico(indicador, horas),
    temConsumo ? historicoConsumo(id, DIAS_GRAFICO) : Promise.resolve([]),
    temConsumo ? consumoDeHoje(indicador) : Promise.resolve(null),
    temConsumo ? historicoEmDia(id) : Promise.resolve(false),
    auth(),
  ]);
  const atual = leituras.find((l) => l.id === id);
  const admin = ehAdmin(session?.user.papel);

  // Dias sem nenhuma leitura (ex.: antes do sensor existir) ficam fora do gráfico;
  // só dias confiáveis (≥ metade das horas com leitura e sem defeito do sensor) entram nas médias.
  const diasComLeitura = dias.filter((d) => d.amostras > 0);
  const diasValidos = dias.filter(diaConfiavel);
  const diasComDefeito = dias.filter((d) => d.problema).length;
  const mediaDia = diasValidos.length
    ? diasValidos.reduce((s, d) => s + d.consumoLitros, 0) / diasValidos.length
    : null;
  const maiorDia = diasValidos.reduce<(typeof diasValidos)[number] | null>(
    (a, d) => (!a || d.consumoLitros > a.consumoLitros ? d : a),
    null
  );

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
              {atual?.timestamp ? ` · leitura em ${formatarDataHoraBR(atual.timestamp)}` : ""}
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

      {temConsumo && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Droplets className="h-5 w-5 text-primary" /> Consumo de água
              </h2>
              {indicador.capacidadeLitros || indicador.leiturasDesde ? (
                <p className="text-xs text-muted">
                  {[
                    indicador.capacidadeLitros && `Capacidade ${formatarVolume(indicador.capacidadeLitros)}`,
                    indicador.reservaLitros && `reserva de incêndio ${formatarVolume(indicador.reservaLitros)}`,
                    indicador.leiturasDesde &&
                      `leituras consideradas a partir de ${indicador.leiturasDesde.split("-").reverse().join("/")}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/agua?sensor=${indicador.id}`}>
                <Button type="button" size="sm">
                  Análise e relatório
                </Button>
              </Link>
              {admin && (
                <form action={recalcularConsumo}>
                  <input type="hidden" name="id" value={indicador.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Recalcular histórico
                  </Button>
                </form>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent>
                <p className="text-sm text-muted">Hoje até agora</p>
                <p className="text-xl font-bold text-foreground">
                  {hoje ? formatarVolume(hoje.consumoLitros) : "—"}
                </p>
                <p className="text-xs text-muted">
                  {hoje == null
                    ? "plataforma indisponível"
                    : hoje.problema === "SALTOS"
                      ? "leituras suspeitas hoje (saltos no sensor)"
                      : hoje.horaPico != null
                      ? `pico às ${hoje.horaPico}h`
                      : "sem consumo registrado"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted">Média diária</p>
                <p className="text-xl font-bold text-foreground">
                  {mediaDia != null ? formatarVolume(mediaDia) : "—"}
                </p>
                <p className="text-xs text-muted">
                  {diasValidos.length} dia(s) com dado confiável
                  {diasComDefeito > 0 ? ` · ${diasComDefeito} com defeito do sensor` : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted">Maior consumo</p>
                <p className="text-xl font-bold text-foreground">
                  {maiorDia ? formatarVolume(maiorDia.consumoLitros) : "—"}
                </p>
                <p className="text-xs text-muted">{maiorDia ? rotuloDia(maiorDia.dia) : "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted">Histórico</p>
                <p className="text-xl font-bold text-foreground">{diasComLeitura.length} dia(s)</p>
                <p className="text-xs text-muted">
                  {emDia ? `com leitura nos últimos ${DIAS_GRAFICO}` : "montando em segundo plano…"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Consumo por dia — últimos {DIAS_GRAFICO} dias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ConsumoChart
                dias={diasComLeitura.map((d) => ({
                  dia: d.dia,
                  consumoLitros: d.consumoLitros,
                  consumoEstimadoLitros: d.consumoEstimadoLitros,
                  cobertura: d.cobertura,
                  problema: d.problema,
                }))}
              />
              <p className="text-xs text-muted">
                Quando a bomba enche a caixa, o nível sobe e o consumo daquele período fica escondido no
                sinal — ele é estimado pela vazão de saída antes e depois do enchimento. Barras claras =
                dia fora das médias: dado incompleto (sensor sem leitura em mais da metade do dia) ou
                defeito detectado no sensor (saltos impossíveis ou nível parado o dia todo).
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
