import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Wrench,
  Building2,
  Tag,
  Ruler,
  Plus,
  CheckCircle2,
  Circle,
  ListChecks,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ServicoForm } from "@/components/forms/servico-form";
import { EtapaServicoForm } from "@/components/forms/etapa-servico-form";
import {
  atualizarServico,
  excluirServico,
  criarEtapaServico,
  atualizarEtapaServico,
  alternarEtapaServico,
  excluirEtapaServico,
} from "@/app/actions/fornecedores";
import { STATUS_SUBOS_LABEL, STATUS_SUBOS_TONE } from "@/lib/manutencao";
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
      include: {
        fornecedor: { select: { id: true, nome: true } },
        etapas: { orderBy: { ordem: "asc" } },
      },
    }),
    prisma.fornecedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  if (!servico) notFound();

  const totalEtapas = servico.etapas.length;
  const feitas = servico.etapas.filter((e) => e.status === "CONCLUIDA").length;
  const progresso = totalEtapas > 0 ? Math.round((feitas / totalEtapas) * 100) : 0;

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

      {/* Etapas do serviço (acompanhamento da execução) */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ListChecks className="h-5 w-5 text-primary" /> Etapas do serviço
          </h2>
          {editavel && (
            <Modal
              title="Nova etapa do serviço"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> Nova etapa
                </span>
              }
            >
              <EtapaServicoForm
                action={criarEtapaServico}
                servicoId={servico.id}
                proximaOrdem={totalEtapas + 1}
              />
            </Modal>
          )}
        </div>

        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              Divida o serviço em fases para acompanhar a execução. Marque cada etapa concluída e o
              progresso atualiza sozinho.
            </p>

            {totalEtapas > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full bg-primary" style={{ width: `${progresso}%` }} />
                </div>
                <span className="text-xs text-muted">
                  {feitas}/{totalEtapas} · {progresso}%
                </span>
              </div>
            )}

            {totalEtapas === 0 ? (
              <p className="text-sm text-muted">Nenhuma etapa cadastrada ainda.</p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {servico.etapas.map((e) => {
                  const concluida = e.status === "CONCLUIDA";
                  return (
                    <li key={e.id} className="flex items-center gap-2 py-2">
                      {editavel ? (
                        <form action={alternarEtapaServico}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="servicoId" value={servico.id} />
                          <button
                            type="submit"
                            title={concluida ? "Reabrir" : "Concluir"}
                            className="flex h-6 w-6 items-center justify-center text-muted hover:text-primary"
                          >
                            {concluida ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </button>
                        </form>
                      ) : concluida ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted" />
                      )}
                      <span
                        className={`flex-1 text-sm ${
                          concluida ? "text-muted line-through" : "text-foreground"
                        }`}
                      >
                        {e.titulo}
                      </span>
                      <Badge tone={STATUS_SUBOS_TONE[e.status]}>{STATUS_SUBOS_LABEL[e.status]}</Badge>
                      {editavel && (
                        <>
                          <Modal
                            title="Editar etapa"
                            trigger={
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-muted">
                                <Pencil className="h-4 w-4" />
                              </span>
                            }
                          >
                            <EtapaServicoForm
                              action={atualizarEtapaServico}
                              etapa={e}
                              servicoId={servico.id}
                            />
                          </Modal>
                          <form action={excluirEtapaServico}>
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="servicoId" value={servico.id} />
                            <ConfirmSubmit />
                          </form>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

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
