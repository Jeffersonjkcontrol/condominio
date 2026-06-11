import Link from "next/link";
import { Plus, HardHat, AlertTriangle, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Filtros } from "@/components/ui/filtros";
import { Paginacao } from "@/components/ui/paginacao";
import { ObraForm } from "@/components/forms/obra-form";
import { criarObra } from "@/app/actions/obras";
import { formatarMoeda, formatarData } from "@/lib/utils";
import { lerPagina, par, type SP } from "@/lib/listagem";
import {
  statusCalculadoObra,
  STATUS_OBRA_LABEL,
  STATUS_OBRA_TONE,
  etapaAtrasada,
} from "@/lib/obras";

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  const editavel = podeEditar(session?.user.papel);

  const sp = await searchParams;
  const busca = par(sp, "busca");
  const { pagina, skip, take } = lerPagina(sp);

  const where = busca
    ? { OR: [{ titulo: { contains: busca } }, { descricao: { contains: busca } }] }
    : {};

  const [obras, totalCount, responsaveis] = await Promise.all([
    prisma.obra.findMany({
      where,
      orderBy: { dataInicioPrev: "desc" },
      skip,
      take,
      include: { etapas: true, responsavel: { select: { nome: true } } },
    }),
    prisma.obra.count({ where }),
    prisma.user.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  const hoje = new Date();

  return (
    <div>
      <PageHeader
        titulo="Obras"
        descricao="Acompanhe obras, cronogramas e atrasos."
        acao={
          editavel && (
            <Modal
              title="Nova obra"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> Nova obra
                </span>
              }
            >
              <ObraForm action={criarObra} responsaveis={responsaveis} />
            </Modal>
          )
        }
      />

      <Filtros buscaDefault={busca ?? ""} placeholder="Buscar obra por título ou descrição…" />

      {totalCount === 0 ? (
        <EmptyState
          titulo={busca ? "Nenhuma obra encontrada" : "Nenhuma obra cadastrada"}
          descricao={
            busca
              ? "Tente ajustar a busca."
              : "Cadastre a primeira obra e adicione etapas para acompanhar o cronograma."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {obras.map((o) => {
            const status = statusCalculadoObra(o.status, o.dataInicioPrev, o.dataFimPrev, o.etapas, hoje);
            const etapasAtrasadas = o.etapas.filter((e) => etapaAtrasada(e, hoje)).length;
            const progressoMedio =
              o.etapas.length > 0
                ? Math.round(
                    o.etapas.reduce((s, e) => s + e.progresso, 0) / o.etapas.length
                  )
                : 0;
            return (
              <Link key={o.id} href={`/obras/${o.id}`}>
                <Card className="h-full transition-colors hover:border-primary">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <HardHat className="h-5 w-5 text-muted" />
                        <span className="font-semibold text-foreground">{o.titulo}</span>
                      </div>
                      <Badge tone={STATUS_OBRA_TONE[status]}>
                        {STATUS_OBRA_LABEL[status]}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted">
                      {formatarData(o.dataInicioPrev)} → {formatarData(o.dataFimPrev)}
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted">
                        <span>Progresso</span>
                        <span>{progressoMedio}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${progressoMedio}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm text-muted">
                        {o.orcamento ? formatarMoeda(o.orcamento) : "—"}
                      </span>
                      {etapasAtrasadas > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {etapasAtrasadas} etapa(s) atrasada(s)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          Detalhes <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Paginacao basePath="/obras" sp={sp} pagina={pagina} total={totalCount} />
    </div>
  );
}
