import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Wrench, Building2, Tag, Ruler } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ServicoForm } from "@/components/forms/servico-form";
import { atualizarServico, excluirServico } from "@/app/actions/fornecedores";
import { formatarMoeda, formatarData } from "@/lib/utils";

export default async function ServicoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const editavel = podeEditar(session?.user.papel);

  const [servico, fornecedores] = await Promise.all([
    prisma.servico.findUnique({
      where: { id },
      include: { fornecedor: { select: { id: true, nome: true } } },
    }),
    prisma.fornecedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  if (!servico) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/servicos"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{servico.nome}</h1>
            <p className="text-sm text-muted">
              Fornecedor:{" "}
              <Link href={`/fornecedores/${servico.fornecedor.id}`} className="hover:text-primary">
                {servico.fornecedor.nome}
              </Link>
            </p>
          </div>
        </div>
        {editavel && (
          <div className="flex items-center gap-2">
            <Modal
              title="Editar serviço"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted">
                  <Pencil className="h-4 w-4" /> Editar
                </span>
              }
            >
              <ServicoForm action={atualizarServico} servico={servico} fornecedores={fornecedores} />
            </Modal>
            <form action={excluirServico}>
              <input type="hidden" name="id" value={servico.id} />
              <input type="hidden" name="redirecionar" value="1" />
              <ConfirmSubmit confirmacao="Excluir este serviço? Esta ação não pode ser desfeita." />
            </form>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Valor padrão</p>
            <p className="mt-1 flex items-center gap-1 text-xl font-bold">
              <Tag className="h-4 w-4 text-muted" /> {formatarMoeda(servico.valorPadrao)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Unidade</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium">
              <Ruler className="h-4 w-4 text-muted" /> {servico.unidade ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Cadastrado em</p>
            <p className="mt-1 text-sm font-medium">{formatarData(servico.criadoEm)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <p className="mb-1 text-sm font-medium text-foreground">Descrição</p>
          <p className="text-sm text-muted">{servico.descricao || "Sem descrição."}</p>
        </CardContent>
      </Card>

      <div>
        <Link href={`/fornecedores/${servico.fornecedor.id}`}>
          <Button variant="outline">
            <Building2 className="h-4 w-4" /> Ver fornecedor
          </Button>
        </Link>
      </div>
    </div>
  );
}
