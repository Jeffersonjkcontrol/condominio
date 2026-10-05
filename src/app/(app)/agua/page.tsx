import { Fragment } from "react";
import Link from "next/link";
import { Droplets, Download, FileSpreadsheet, Lightbulb, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { ehAdmin } from "@/lib/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { ConsumoChart } from "@/components/consumo-chart";
import { BarrasSimples } from "@/components/barras-simples";
import { AguaFiltros } from "@/components/agua-filtros";
import { montarRelatorioAgua } from "@/lib/relatorio-agua";
import { diaConfiavel, formatarVolume } from "@/lib/agua-calc";
import { pct, rotuloDia, vazaoHora, SEMANA_LONGA, type DiaRelatorio } from "@/lib/agua-relatorio";
import type { DiaConsumo } from "@/lib/agua";
import type { SP } from "@/lib/listagem";

const DIAS_MAPA = 62; // mapa de calor: no máximo os ~2 últimos meses (legível no celular)

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted">{titulo}</p>
        <p className="text-xl font-bold text-foreground">{valor}</p>
        {detalhe && <p className="text-xs text-muted">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

/** Mapa de calor hora × dia (dias mais recentes no topo). Dias fora das médias ficam cinza. */
function MapaDeCalor({ dias }: { dias: DiaConsumo[] }) {
  const linhas = dias
    .filter((d) => d.amostras > 0 && d.porHora.length === 24)
    .slice(-DIAS_MAPA)
    .reverse();
  if (linhas.length === 0) return <p className="py-6 text-center text-sm text-muted">Sem dias com leitura.</p>;
  const max = Math.max(1, ...linhas.filter(diaConfiavel).flatMap((d) => d.porHora));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] grid-cols-[72px_repeat(24,minmax(0,1fr))] gap-px text-[10px] text-muted">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center">
            {h % 3 === 0 ? `${h}h` : ""}
          </div>
        ))}
        {linhas.map((d) => {
          const ok = diaConfiavel(d);
          return (
            <Fragment key={d.dia}>
              <div className="pr-1 text-right leading-4">{rotuloDia(d.dia, true)}</div>
              {d.porHora.map((l, h) => (
                <div
                  key={h}
                  className="h-4 rounded-[2px]"
                  title={`${rotuloDia(d.dia, true)} · ${h}h: ${formatarVolume(l)}${ok ? "" : " (dia fora das médias)"}`}
                  style={{
                    background: ok
                      ? `color-mix(in srgb, var(--primary) ${Math.round(Math.min(1, l / max) * 100)}%, var(--surface-muted))`
                      : "var(--surface-muted)",
                  }}
                />
              ))}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function TabelaDias({
  linhas,
  mediana,
  eventos,
}: {
  linhas: { dia: DiaRelatorio; variacao?: number }[];
  mediana: number | null;
  eventos: Map<string, string[]>;
}) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Dia</TH>
          <TH className="text-right">Consumo</TH>
          <TH className="text-right">vs mediana</TH>
          <TH>Eventos</TH>
        </tr>
      </THead>
      <tbody>
        {linhas.map(({ dia: d, variacao }) => {
          const v = variacao ?? (mediana ? (d.consumoLitros - mediana) / mediana : null);
          return (
            <TR key={d.dia}>
              <TD className="whitespace-nowrap">{rotuloDia(d.dia, true)}</TD>
              <TD className="whitespace-nowrap text-right font-medium">{formatarVolume(d.consumoLitros)}</TD>
              <TD className="whitespace-nowrap text-right text-muted">{v != null ? pct(v) : "—"}</TD>
              <TD className="text-muted">{(eventos.get(d.dia) ?? []).join(", ") || "—"}</TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}

export default async function AguaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const um = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  };
  const [rel, session] = await Promise.all([
    montarRelatorioAgua({ sensorId: um("sensor"), periodo: um("periodo"), de: um("de"), ate: um("ate") }),
    auth(),
  ]);

  if (!rel) {
    return (
      <div>
        <PageHeader titulo="Consumo de água" descricao="Análise do consumo a partir de sensores de nível de reservatório." />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            Nenhum sensor de consumo cadastrado.{" "}
            {ehAdmin(session?.user.papel) ? (
              <>
                Em <Link href="/configuracoes" className="text-primary hover:underline">Configurações</Link>,
                cadastre um sensor do tipo <strong>Nível de reservatório</strong> (ou hidrômetro).
              </>
            ) : (
              "Peça ao síndico para cadastrar o sensor do reservatório."
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { resumo: s, periodo, anterior, sensor } = rel;
  const q = s.qualidade;
  const qs = new URLSearchParams({ sensor: sensor.id, periodo: periodo.preset, de: periodo.de, ate: periodo.ate });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Consumo de água"
        descricao={`${sensor.nome} · ${periodo.rotulo}`}
        acao={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/agua/relatorio?${qs}&formato=pdf`}>
              <Button type="button">
                <Download className="h-4 w-4" /> PDF
              </Button>
            </a>
            <a href={`/api/agua/relatorio?${qs}&formato=xlsx`}>
              <Button type="button" variant="outline">
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
            </a>
          </div>
        }
      />

      <AguaFiltros
        sensores={rel.sensores}
        sensorId={sensor.id}
        preset={periodo.preset}
        de={periodo.de}
        ate={periodo.ate}
      />

      {rel.destaques.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" /> Destaques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
              {rel.destaques.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          titulo="Total medido"
          valor={formatarVolume(s.totalConfiavelLitros)}
          detalhe={`${q.confiaveis} de ${q.diasPeriodo} dia(s) confiáveis`}
        />
        <Kpi
          titulo="Média diária"
          valor={s.mediaDiariaLitros != null ? formatarVolume(s.mediaDiariaLitros) : "—"}
          detalhe={
            s.variacaoMedia != null
              ? `${pct(s.variacaoMedia)} vs ${anterior.curto}`
              : `sem base de comparação (${anterior.rotulo})`
          }
        />
        {s.projecaoMesLitros != null ? (
          <Kpi titulo="Projeção do mês" valor={formatarVolume(s.projecaoMesLitros)} detalhe="média diária × dias do mês" />
        ) : (
          <Kpi
            titulo="Estimativa do período"
            valor={s.estimativaPeriodoLitros != null ? formatarVolume(s.estimativaPeriodoLitros) : "—"}
            detalhe={`média diária × ${q.diasPeriodo} dias`}
          />
        )}
        <Kpi
          titulo="Maior consumo"
          valor={s.maiores[0] ? formatarVolume(s.maiores[0].consumoLitros) : "—"}
          detalhe={s.maiores[0] ? rotuloDia(s.maiores[0].dia, true) : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumo por dia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ConsumoChart
            dias={rel.dias
              .filter((d) => d.amostras > 0)
              .map((d) => ({
                dia: d.dia,
                consumoLitros: d.consumoLitros,
                consumoEstimadoLitros: d.consumoEstimadoLitros,
                cobertura: d.cobertura,
                problema: d.problema,
              }))}
          />
          <p className="text-xs text-muted">Barras claras = dia fora das médias (dado incompleto ou defeito do sensor).</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Média por dia da semana</CardTitle>
          </CardHeader>
          <CardContent>
            <BarrasSimples
              formato="volume"
              dados={s.porDiaSemana.map((x) => ({
                rotulo: SEMANA_LONGA[x.semana].slice(0, 3),
                valor: x.mediaLitros,
                destaque: x.mediaLitros != null && x.mediaLitros === Math.max(...s.porDiaSemana.map((y) => y.mediaLitros ?? 0)),
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Perfil por hora</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <BarrasSimples
              formato="vazao"
              dados={s.perfilHora.map((l, h) => ({ rotulo: `${h}h`, valor: l, destaque: h === s.horaPico }))}
            />
            {s.horaPico != null && s.madrugadaLitrosHora != null && (
              <p className="text-xs text-muted">
                Pico às {s.horaPico}h ({vazaoHora(s.perfilHora[s.horaPico])}). Madrugada (0h–6h): média de{" "}
                {vazaoHora(s.madrugadaLitrosHora)}, {Math.round((s.madrugadaFracaoDoPico ?? 0) * 100)}% do pico.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mapa de calor — consumo por hora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <MapaDeCalor dias={rel.dias} />
          <p className="text-xs text-muted">
            Cada linha é um dia (mais recente no topo); quanto mais forte a cor, maior o consumo naquela hora.
            Passe o mouse para ver o valor. Dias fora das médias ficam cinza.
            {rel.dias.length > DIAS_MAPA ? ` Mostrando os ${DIAS_MAPA} dias mais recentes.` : ""}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Maiores consumos</CardTitle>
          </CardHeader>
          <CardContent>
            {s.maiores.length ? (
              <TabelaDias linhas={s.maiores.map((dia) => ({ dia }))} mediana={s.medianaLitros} eventos={rel.eventos} />
            ) : (
              <p className="text-sm text-muted">Sem dias confiáveis no período.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Menores consumos</CardTitle>
          </CardHeader>
          <CardContent>
            {s.menores.length ? (
              <TabelaDias linhas={s.menores.map((dia) => ({ dia }))} mediana={s.medianaLitros} eventos={rel.eventos} />
            ) : (
              <p className="text-sm text-muted">Poucos dias no período para separar os menores.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {s.atipicos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dias atípicos (±30% da mediana de {formatarVolume(s.medianaLitros!)})</CardTitle>
          </CardHeader>
          <CardContent>
            <TabelaDias linhas={s.atipicos} mediana={s.medianaLitros} eventos={rel.eventos} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Qualidade do dado</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          {[
            ["Confiáveis", q.confiaveis],
            ["Incompletos", q.incompletos],
            ["Com defeito do sensor", q.comDefeito],
            ["Sem leitura", q.semLeitura],
            ["Parte estimada", q.fracaoEstimada != null ? `${Math.round(q.fracaoEstimada * 100)}%` : "—"],
            ["Cobertura (últimos 7 dias)", `${Math.round(q.coberturaUltimos7 * 100)}%`],
          ].map(([rotulo, valor]) => (
            <div key={String(rotulo)}>
              <p className="text-xs text-muted">{rotulo}</p>
              <p className="font-semibold text-foreground">{valor}</p>
            </div>
          ))}
          <p className="col-span-full text-xs text-muted">
            Confiável = sensor com leitura em pelo menos metade das horas e sem defeito detectado. A parte
            estimada é o consumo que aconteceu enquanto a caixa enchia (fica escondido no nível).
            {sensor.leiturasDesde ? ` Leituras consideradas a partir de ${rotuloDia(sensor.leiturasDesde)}.` : ""}
          </p>
        </CardContent>
      </Card>

      <Link
        href={`/indicadores/${sensor.id}`}
        className="group inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
      >
        <Droplets className="h-4 w-4" /> Ver o sensor ao vivo
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
