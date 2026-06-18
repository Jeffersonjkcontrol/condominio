import Link from "next/link";
import { Plus, Pencil, FileSpreadsheet, FileText, Paperclip } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Filtros } from "@/components/ui/filtros";
import { Paginacao } from "@/components/ui/paginacao";
import { DeleteButton } from "@/components/delete-button";
import { ReciboForm } from "@/components/forms/recibo-form";
import { criarRecibo, atualizarRecibo, excluirRecibo } from "@/app/actions/recibos";
import { formatarMoeda, formatarData } from "@/lib/utils";
import { CATEGORIAS_RECIBO } from "@/lib/recibos-config";
import { lerPagina, par, type SP } from "@/lib/listagem";

export default async function RecibosPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  const editavel = podeEditar(session?.user.papel);

  const sp = await searchParams;
  const busca = par(sp, "busca");
  const statusF = par(sp, "status");
  const categoriaF = par(sp, "categoria");
  const { pagina, skip, take } = lerPagina(sp);

  const where: Prisma.ReciboWhereInput = {
    ...(statusF === "PENDENTE" || statusF === "CONFERIDO" ? { status: statusF } : {}),
    ...(categoriaF ? { categoria: categoriaF } : {}),
    ...(busca
      ? {
          OR: [
            { descricao: { contains: busca } },
            { categoria: { contains: busca } },
            { fornecedor: { nome: { contains: busca } } },
          ],
        }
      : {}),
  };

  const [recibos, totalCount, agg, pendentes, fornecedores, obrasRaw, servicos, recorrenciasRaw] =
    await Promise.all([
      prisma.recibo.findMany({
        where,
        orderBy: { dataEmissao: "desc" },
        skip,
        take,
        include: { fornecedor: { select: { id: true, nome: true } } },
      }),
      prisma.recibo.count({ where }),
      prisma.recibo.aggregate({ where, _sum: { valor: true } }),
      prisma.recibo.count({ where: { ...where, status: "PENDENTE" } }),
      prisma.fornecedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      prisma.obra.findMany({ orderBy: { dataInicioPrev: "desc" }, select: { id: true, titulo: true } }),
      prisma.servico.findMany({
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, valorPadrao: true, fornecedorId: true },
      }),
      prisma.recorrencia.findMany({
        where: { ativo: true },
        orderBy: { descricao: "asc" },
        select: { id: true, descricao: true },
      }),
    ]);
  const obras = obrasRaw.map((o) => ({ id: o.id, nome: o.titulo }));
  const recorrencias = recorrenciasRaw.map((r) => ({ id: r.id, nome: r.descricao }));

  const total = agg._sum.valor ?? 0;
  const temFiltro = Boolean(busca || statusF || categoriaF);

  return (
    <div>
      <PageHeader
        titulo="Recibos"
        descricao="Receba, leia e organize recibos. Exporte relatórios formatados."
        acao={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/api/recibos/export?formato=xlsx"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Link>
            <Link
              href="/api/recibos/export?formato=pdf"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
            >
              <FileText className="h-4 w-4" /> PDF
            </Link>
            {editavel && (
              <Modal
                title="Novo recibo"
                trigger={
                  <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                    <Plus className="h-4 w-4" /> Novo recibo
                  </span>
                }
              >
                <ReciboForm
                  action={criarRecibo}
                  fornecedores={fornecedores}
                  obras={obras}
                  servicos={servicos}
                  recorrencias={recorrencias}
                />
              </Modal>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Total registrado</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{formatarMoeda(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Recibos</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Pendentes de conferência</p>
            <p className="mt-1 text-2xl font-bold text-warning">{pendentes}</p>
          </CardContent>
        </Card>
      </div>

      <Filtros buscaDefault={busca ?? ""} placeholder="Buscar por descrição, categoria ou fornecedor…">
        <Select name="status" defaultValue={statusF ?? ""} className="w-auto">
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="CONFERIDO">Conferido</option>
        </Select>
        <Select name="categoria" defaultValue={categoriaF ?? ""} className="w-auto">
          <option value="">Todas as categorias</option>
          {CATEGORIAS_RECIBO.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Filtros>

      {totalCount === 0 ? (
        <EmptyState
          titulo={temFiltro ? "Nenhum recibo encontrado" : "Nenhum recibo cadastrado"}
          descricao={
            temFiltro
              ? "Tente ajustar a busca ou os filtros."
              : "Adicione um recibo — anexe a imagem ou PDF para leitura automática dos dados."
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Data</TH>
              <TH>Categoria</TH>
              <TH>Fornecedor</TH>
              <TH>Valor</TH>
              <TH>Status</TH>
              <TH>Anexo</TH>
              {editavel && <TH className="text-right">Ações</TH>}
            </tr>
          </THead>
          <tbody>
            {recibos.map((r) => (
              <TR key={r.id}>
                <TD>{formatarData(r.dataEmissao)}</TD>
                <TD>
                  <div className="font-medium">{r.categoria}</div>
                  {r.descricao && (
                    <div className="text-xs text-muted">{r.descricao}</div>
                  )}
                </TD>
                <TD>
                  {r.fornecedor ? (
                    <Link href={`/fornecedores/${r.fornecedorId}`} className="hover:text-primary">
                      {r.fornecedor.nome}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD className="font-medium">{formatarMoeda(r.valor)}</TD>
                <TD>
                  {r.status === "CONFERIDO" ? (
                    <Badge tone="success">Conferido</Badge>
                  ) : (
                    <Badge tone="warning">Pendente</Badge>
                  )}
                </TD>
                <TD>
                  {r.arquivoUrl ? (
                    <a
                      href={r.arquivoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Paperclip className="h-4 w-4" /> ver
                    </a>
                  ) : (
                    "—"
                  )}
                </TD>
                {editavel && (
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Modal
                        title="Editar recibo"
                        trigger={
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-muted">
                            <Pencil className="h-4 w-4" />
                          </span>
                        }
                      >
                        <ReciboForm
                          action={atualizarRecibo}
                          recibo={r}
                          fornecedores={fornecedores}
                          obras={obras}
                          servicos={servicos}
                          recorrencias={recorrencias}
                        />
                      </Modal>
                      <DeleteButton action={excluirRecibo} id={r.id} />
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Paginacao basePath="/recibos" sp={sp} pagina={pagina} total={totalCount} />
    </div>
  );
}
