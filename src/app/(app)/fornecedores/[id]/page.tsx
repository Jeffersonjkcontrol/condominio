import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Mail, Phone, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/page-header";
import { DeleteButton } from "@/components/delete-button";
import { ServicoForm } from "@/components/forms/servico-form";
import {
  criarServico,
  atualizarServico,
  excluirServico,
} from "@/app/actions/fornecedores";
import { formatarMoeda } from "@/lib/utils";

export default async function FornecedorDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const editavel = podeEditar(session?.user.papel);

  const fornecedor = await prisma.fornecedor.findUnique({
    where: { id },
    include: { servicos: { orderBy: { nome: "asc" } } },
  });
  if (!fornecedor) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/fornecedores"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{fornecedor.nome}</h1>
        {fornecedor.cnpjCpf && (
          <p className="text-sm text-muted">{fornecedor.cnpjCpf}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted" />
            <span className="text-sm">{fornecedor.telefone ?? "—"}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted" />
            <span className="text-sm">{fornecedor.email ?? "—"}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-muted" />
            <span className="text-sm">{fornecedor.endereco ?? "—"}</span>
          </CardContent>
        </Card>
      </div>

      {fornecedor.observacoes && (
        <Card>
          <CardContent>
            <p className="text-sm text-muted">{fornecedor.observacoes}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Serviços prestados</h2>
        {editavel && (
          <Modal
            title="Novo serviço"
            trigger={
              <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                <Plus className="h-4 w-4" /> Novo serviço
              </span>
            }
          >
            <ServicoForm action={criarServico} fornecedorId={fornecedor.id} />
          </Modal>
        )}
      </div>

      {fornecedor.servicos.length === 0 ? (
        <EmptyState titulo="Nenhum serviço cadastrado para este fornecedor" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Serviço</TH>
              <TH>Valor padrão</TH>
              <TH>Unidade</TH>
              {editavel && <TH className="text-right">Ações</TH>}
            </tr>
          </THead>
          <tbody>
            {fornecedor.servicos.map((s) => (
              <TR key={s.id}>
                <TD>
                  <Link
                    href={`/servicos/${s.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {s.nome}
                  </Link>
                  {s.descricao && (
                    <div className="text-xs text-muted">{s.descricao}</div>
                  )}
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
                          fornecedorId={fornecedor.id}
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
    </div>
  );
}
