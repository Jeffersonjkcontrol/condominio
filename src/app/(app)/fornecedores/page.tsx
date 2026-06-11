import { Plus, Pencil, Building2 } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Filtros } from "@/components/ui/filtros";
import { Paginacao } from "@/components/ui/paginacao";
import { DeleteButton } from "@/components/delete-button";
import { FornecedorForm } from "@/components/forms/fornecedor-form";
import {
  criarFornecedor,
  atualizarFornecedor,
  excluirFornecedor,
} from "@/app/actions/fornecedores";
import { lerPagina, par, type SP } from "@/lib/listagem";

export default async function FornecedoresPage({
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
          { cnpjCpf: { contains: busca } },
          { email: { contains: busca } },
          { telefone: { contains: busca } },
        ],
      }
    : {};

  const [fornecedores, totalCount] = await Promise.all([
    prisma.fornecedor.findMany({
      where,
      orderBy: { nome: "asc" },
      skip,
      take,
      include: { _count: { select: { servicos: true, recibos: true } } },
    }),
    prisma.fornecedor.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Fornecedores"
        descricao="Cadastro de fornecedores e prestadores de serviço."
        acao={
          editavel && (
            <Modal
              title="Novo fornecedor"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> Novo fornecedor
                </span>
              }
            >
              <FornecedorForm action={criarFornecedor} />
            </Modal>
          )
        }
      />

      <Filtros buscaDefault={busca ?? ""} placeholder="Buscar por nome, CNPJ/CPF, e-mail ou telefone…" />

      {totalCount === 0 ? (
        <EmptyState
          titulo={busca ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
          descricao={busca ? "Tente ajustar a busca." : "Cadastre o primeiro fornecedor para começar."}
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Nome</TH>
              <TH>Contato</TH>
              <TH>Serviços</TH>
              <TH>Recibos</TH>
              {editavel && <TH className="text-right">Ações</TH>}
            </tr>
          </THead>
          <tbody>
            {fornecedores.map((f) => (
              <TR key={f.id}>
                <TD>
                  <Link
                    href={`/fornecedores/${f.id}`}
                    className="flex items-center gap-2 font-medium hover:text-primary"
                  >
                    <Building2 className="h-4 w-4 text-muted" />
                    {f.nome}
                  </Link>
                  {f.cnpjCpf && (
                    <span className="text-xs text-muted">{f.cnpjCpf}</span>
                  )}
                </TD>
                <TD>
                  <div className="text-sm">{f.telefone ?? "—"}</div>
                  <div className="text-xs text-muted">{f.email ?? ""}</div>
                </TD>
                <TD>
                  <Badge tone="info">{f._count.servicos}</Badge>
                </TD>
                <TD>
                  <Badge>{f._count.recibos}</Badge>
                </TD>
                {editavel && (
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Modal
                        title="Editar fornecedor"
                        trigger={
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-muted">
                            <Pencil className="h-4 w-4" />
                          </span>
                        }
                      >
                        <FornecedorForm action={atualizarFornecedor} fornecedor={f} />
                      </Modal>
                      <DeleteButton action={excluirFornecedor} id={f.id} />
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Paginacao basePath="/fornecedores" sp={sp} pagina={pagina} total={totalCount} />
    </div>
  );
}
