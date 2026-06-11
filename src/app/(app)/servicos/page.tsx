import Link from "next/link";
import { Plus, Pencil, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Filtros } from "@/components/ui/filtros";
import { Paginacao } from "@/components/ui/paginacao";
import { DeleteButton } from "@/components/delete-button";
import { ServicoForm } from "@/components/forms/servico-form";
import { criarServico, atualizarServico, excluirServico } from "@/app/actions/fornecedores";
import { formatarMoeda } from "@/lib/utils";
import { lerPagina, par, type SP } from "@/lib/listagem";

export default async function ServicosPage({
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
    ? {
        OR: [
          { nome: { contains: busca } },
          { descricao: { contains: busca } },
          { fornecedor: { nome: { contains: busca } } },
        ],
      }
    : {};

  const [servicos, totalCount, fornecedores] = await Promise.all([
    prisma.servico.findMany({
      where,
      orderBy: { nome: "asc" },
      skip,
      take,
      include: { fornecedor: { select: { id: true, nome: true } } },
    }),
    prisma.servico.count({ where }),
    prisma.fornecedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Serviços"
        descricao="Catálogo de serviços oferecidos pelos fornecedores."
        acao={
          editavel &&
          fornecedores.length > 0 && (
            <Modal
              title="Novo serviço"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> Novo serviço
                </span>
              }
            >
              <ServicoForm action={criarServico} fornecedores={fornecedores} />
            </Modal>
          )
        }
      />

      <Filtros buscaDefault={busca ?? ""} placeholder="Buscar serviço por nome, descrição ou fornecedor…" />

      {totalCount === 0 ? (
        <EmptyState
          titulo={busca ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
          descricao={
            busca
              ? "Tente ajustar a busca."
              : fornecedores.length === 0
                ? "Cadastre um fornecedor antes de adicionar serviços."
                : "Cadastre o primeiro serviço."
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Serviço</TH>
              <TH>Fornecedor</TH>
              <TH>Valor padrão</TH>
              <TH>Unidade</TH>
              {editavel && <TH className="text-right">Ações</TH>}
            </tr>
          </THead>
          <tbody>
            {servicos.map((s) => (
              <TR key={s.id}>
                <TD>
                  <Link
                    href={`/servicos/${s.id}`}
                    className="flex items-center gap-2 font-medium hover:text-primary"
                  >
                    <Wrench className="h-4 w-4 text-muted" />
                    {s.nome}
                  </Link>
                </TD>
                <TD>
                  <Link
                    href={`/fornecedores/${s.fornecedor.id}`}
                    className="hover:text-primary"
                  >
                    {s.fornecedor.nome}
                  </Link>
                </TD>
                <TD>{formatarMoeda(s.valorPadrao)}</TD>
                <TD>{s.unidade ?? "—"}</TD>
                {editavel && (
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Modal
                        title="Editar serviço"
                        trigger={
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-muted">
                            <Pencil className="h-4 w-4" />
                          </span>
                        }
                      >
                        <ServicoForm
                          action={atualizarServico}
                          servico={s}
                          fornecedores={fornecedores}
                        />
                      </Modal>
                      <DeleteButton action={excluirServico} id={s.id} />
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Paginacao basePath="/servicos" sp={sp} pagina={pagina} total={totalCount} />
    </div>
  );
}
