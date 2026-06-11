import Link from "next/link";
import {
  Wallet,
  ReceiptText,
  HardHat,
  AlertTriangle,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GastosPorCategoria, GastosPorMes } from "@/components/charts";
import { formatarMoeda } from "@/lib/utils";
import {
  etapaAtrasada,
  diasAtraso,
  statusCalculadoObra,
  STATUS_OBRA_LABEL,
  STATUS_OBRA_TONE,
} from "@/lib/obras";

function Kpi({
  titulo,
  valor,
  icon: Icon,
  tone = "primary",
  href,
}: {
  titulo: string;
  valor: string;
  icon: LucideIcon;
  tone?: "primary" | "warning" | "danger" | "success";
  href?: string;
}) {
  const cores = {
    primary: "bg-primary/15 text-primary",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
    success: "bg-success/15 text-success",
  };
  const conteudo = (
    <Card className={href ? "h-full transition-colors hover:border-primary" : undefined}>
      <CardContent className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${cores[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted">{titulo}</p>
          <p className="text-2xl font-bold text-foreground">{valor}</p>
        </div>
        {href && <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted" />}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [recibos, obras] = await Promise.all([
    prisma.recibo.findMany({ include: { fornecedor: { select: { nome: true } } } }),
    prisma.obra.findMany({ include: { etapas: true } }),
  ]);

  // KPIs
  const gastoMes = recibos
    .filter((r) => r.dataEmissao >= inicioMes)
    .reduce((s, r) => s + r.valor, 0);
  const recibosPendentes = recibos.filter((r) => r.status === "PENDENTE").length;
  const obrasAtivas = obras.filter(
    (o) => statusCalculadoObra(o.status, o.dataInicioPrev, o.dataFimPrev, o.etapas, hoje) !== "CONCLUIDA"
  ).length;
  const etapasAtrasadas = obras.flatMap((o) =>
    o.etapas.filter((e) => etapaAtrasada(e, hoje))
  ).length;

  // Gráfico: gastos por categoria
  const porCategoriaMap = new Map<string, number>();
  recibos.forEach((r) =>
    porCategoriaMap.set(r.categoria, (porCategoriaMap.get(r.categoria) ?? 0) + r.valor)
  );
  const gastosPorCategoria = [...porCategoriaMap.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  // Gráfico: gastos últimos 6 meses
  const meses: { nome: string; valor: number; chave: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({
      chave: `${d.getFullYear()}-${d.getMonth()}`,
      nome: d.toLocaleDateString("pt-BR", { month: "short" }),
      valor: 0,
    });
  }
  recibos.forEach((r) => {
    const chave = `${r.dataEmissao.getFullYear()}-${r.dataEmissao.getMonth()}`;
    const m = meses.find((x) => x.chave === chave);
    if (m) m.valor += r.valor;
  });

  // Obras com atraso (ranking)
  const obrasComAtraso = obras
    .map((o) => {
      const atrasos = o.etapas.filter((e) => etapaAtrasada(e, hoje));
      const dias = atrasos.reduce((s, e) => s + diasAtraso(e, hoje), 0);
      return { obra: o, qtd: atrasos.length, dias };
    })
    .filter((x) => x.qtd > 0)
    .sort((a, b) => b.dias - a.dias);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {session?.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-muted">Visão geral da gestão do condomínio.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Gastos no mês" valor={formatarMoeda(gastoMes)} icon={Wallet} href="/recibos" />
        <Kpi
          titulo="Recibos pendentes"
          valor={String(recibosPendentes)}
          icon={ReceiptText}
          tone="warning"
          href="/recibos?status=PENDENTE"
        />
        <Kpi
          titulo="Obras ativas"
          valor={String(obrasAtivas)}
          icon={HardHat}
          tone="success"
          href="/obras"
        />
        <Kpi
          titulo="Etapas atrasadas"
          valor={String(etapasAtrasadas)}
          icon={AlertTriangle}
          tone="danger"
          href="/obras"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <GastosPorCategoria dados={gastosPorCategoria} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gastos nos últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <GastosPorMes dados={meses.map(({ nome, valor }) => ({ nome, valor }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Análise de atrasos de obras</CardTitle>
        </CardHeader>
        <CardContent>
          {obrasComAtraso.length === 0 ? (
            <p className="py-6 text-center text-sm text-success">
              Nenhuma obra com atraso. Tudo em dia! ✅
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {obrasComAtraso.map(({ obra, qtd, dias }) => {
                const status = statusCalculadoObra(obra.status, obra.dataInicioPrev, obra.dataFimPrev, obra.etapas, hoje);
                return (
                  <li key={obra.id}>
                    <Link
                      href={`/obras/${obra.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:text-primary"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-danger" />
                        <div>
                          <p className="font-medium text-foreground">{obra.titulo}</p>
                          <p className="text-xs text-muted">
                            {qtd} etapa(s) atrasada(s) · {dias} dia(s) de atraso acumulado
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={STATUS_OBRA_TONE[status]}>
                          {STATUS_OBRA_LABEL[status]}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
