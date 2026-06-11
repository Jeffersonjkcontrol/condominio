import { Plus, Pencil, Repeat, CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Filtros } from "@/components/ui/filtros";
import { Paginacao } from "@/components/ui/paginacao";
import { DeleteButton } from "@/components/delete-button";
import { RecorrenciaForm } from "@/components/forms/recorrencia-form";
import {
  criarRecorrencia,
  atualizarRecorrencia,
  excluirRecorrencia,
} from "@/app/actions/recorrencias";
import { formatarMoeda } from "@/lib/utils";
import { lerPagina, par, type SP } from "@/lib/listagem";

export default async function RecorrenciasPage({
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
    ? { OR: [{ descricao: { contains: busca } }, { categoria: { contains: busca } }] }
    : {};

  const [recorrencias, totalCount, fornecedores, ativasAgg] = await Promise.all([
    prisma.recorrencia.findMany({
      where,
      orderBy: [{ ativo: "desc" }, { descricao: "asc" }],
      skip,
      take,
      include: {
        fornecedor: { select: { nome: true } },
        _count: { select: { recibos: true } },
      },
    }),
    prisma.recorrencia.count({ where }),
    prisma.fornecedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.recorrencia.aggregate({ where: { ativo: true }, _sum: { valor: true } }),
  ]);

  const totalMensal = ativasAgg._sum.valor ?? 0;

  return (
    <div>
      <PageHeader
        titulo="Contas fixas (recorrências)"
        descricao="Despesas que se repetem todo mês — o sistema lança o recibo automaticamente ao abrir o app."
        acao={
          editavel && (
            <Modal
              title="Nova conta fixa"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> Nova conta fixa
                </span>
              }
            >
              <RecorrenciaForm action={criarRecorrencia} fornecedores={fornecedores} />
            </Modal>
          )
        }
      />

      <div className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
        <CalendarClock className="h-5 w-5 text-primary" />
        <span className="text-sm text-muted">Compromisso mensal estimado (ativas):</span>
        <span className="text-lg font-bold text-foreground">{formatarMoeda(totalMensal)}</span>
      </div>

      <Filtros buscaDefault={busca ?? ""} placeholder="Buscar conta fixa por descrição ou categoria…" />

      {totalCount === 0 ? (
        <EmptyState
          titulo={busca ? "Nenhuma conta fixa encontrada" : "Nenhuma conta fixa cadastrada"}
          descricao={
            busca
              ? "Tente ajustar a busca."
              : "Cadastre água, luz, salário do zelador, contratos… e o sistema lança os recibos todo mês."
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Descrição</TH>
              <TH>Categoria</TH>
              <TH>Fornecedor</TH>
              <TH>Valor estimado</TH>
              <TH>Vencimento</TH>
              <TH>Status</TH>
              <TH>Lançados</TH>
              {editavel && <TH className="text-right">Ações</TH>}
            </tr>
          </THead>
          <tbody>
            {recorrencias.map((r) => (
              <TR key={r.id}>
                <TD>
                  <div className="flex items-center gap-2 font-medium">
                    <Repeat className="h-4 w-4 text-muted" />
                    {r.descricao}
                  </div>
                </TD>
                <TD>{r.categoria}</TD>
                <TD>{r.fornecedor?.nome ?? "—"}</TD>
                <TD className="font-medium">{formatarMoeda(r.valor)}</TD>
                <TD>todo dia {r.diaVencimento}</TD>
                <TD>
                  {r.ativo ? (
                    <Badge tone="success">Ativa</Badge>
                  ) : (
                    <Badge tone="default">Pausada</Badge>
                  )}
                </TD>
                <TD>
                  <Badge tone="info">{r._count.recibos}</Badge>
                </TD>
                {editavel && (
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Modal
                        title="Editar conta fixa"
                        trigger={
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-muted">
                            <Pencil className="h-4 w-4" />
                          </span>
                        }
                      >
                        <RecorrenciaForm
                          action={atualizarRecorrencia}
                          recorrencia={r}
                          fornecedores={fornecedores}
                        />
                      </Modal>
                      <DeleteButton action={excluirRecorrencia} id={r.id} />
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Paginacao basePath="/recorrencias" sp={sp} pagina={pagina} total={totalCount} />
    </div>
  );
}
