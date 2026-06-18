import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Gantt } from "@/components/gantt";
import { ObraForm } from "@/components/forms/obra-form";
import { EtapaForm } from "@/components/forms/etapa-form";
import { SubEtapaForm } from "@/components/forms/subetapa-form";
import {
  atualizarObra,
  criarEtapa,
  atualizarEtapa,
  excluirEtapa,
  criarSubEtapa,
  atualizarSubEtapa,
  alternarSubEtapa,
  excluirSubEtapa,
} from "@/app/actions/obras";
import { formatarMoeda, formatarData } from "@/lib/utils";
import {
  statusCalculadoObra,
  statusCalculadoEtapa,
  STATUS_OBRA_LABEL,
  STATUS_OBRA_TONE,
  etapaAtrasada,
  diasAtraso,
} from "@/lib/obras";
import { STATUS_SUBOS_LABEL, STATUS_SUBOS_TONE } from "@/lib/manutencao";

export default async function ObraDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const editavel = podeEditar(session?.user.papel);

  const [obra, responsaveis] = await Promise.all([
    prisma.obra.findUnique({
      where: { id },
      include: {
        etapas: {
          orderBy: { ordem: "asc" },
          include: { subEtapas: { orderBy: { ordem: "asc" } } },
        },
        responsavel: { select: { nome: true } },
        recibos: {
          orderBy: { dataEmissao: "desc" },
          include: { fornecedor: { select: { nome: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);
  if (!obra) notFound();

  const hoje = new Date();
  const status = statusCalculadoObra(obra.status, obra.dataInicioPrev, obra.dataFimPrev, obra.etapas, hoje);
  const etapasAtrasadas = obra.etapas.filter((e) => etapaAtrasada(e, hoje));
  const totalAtraso = etapasAtrasadas.reduce((s, e) => s + diasAtraso(e, hoje), 0);

  // Orçado × Realizado
  const realizado = obra.recibos.reduce((s, r) => s + r.valor, 0);
  const orcado = obra.orcamento ?? 0;
  const pctConsumido = orcado > 0 ? Math.round((realizado / orcado) * 100) : 0;
  const estouro = orcado > 0 && realizado > orcado;
  const saldo = orcado - realizado;

  return (
    <div className="space-y-6">
      <Link
        href="/obras"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{obra.titulo}</h1>
            <Badge tone={STATUS_OBRA_TONE[status]}>{STATUS_OBRA_LABEL[status]}</Badge>
          </div>
          {obra.descricao && <p className="mt-1 text-sm text-muted">{obra.descricao}</p>}
        </div>
        {editavel && (
          <Modal
            title="Editar obra"
            trigger={
              <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted">
                <Pencil className="h-4 w-4" /> Editar obra
              </span>
            }
          >
            <ObraForm action={atualizarObra} obra={obra} responsaveis={responsaveis} />
          </Modal>
        )}
      </div>

      {/* Análise de atrasos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Período previsto</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium">
              <CalendarRange className="h-4 w-4 text-muted" />
              {formatarData(obra.dataInicioPrev)} – {formatarData(obra.dataFimPrev)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Orçamento</p>
            <p className="mt-1 text-lg font-bold">{formatarMoeda(obra.orcamento)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Responsável</p>
            <p className="mt-1 text-sm font-medium">{obra.responsavel?.nome ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className={etapasAtrasadas.length > 0 ? "border-danger/40" : ""}>
          <CardContent>
            <p className="text-sm text-muted">Atrasos</p>
            {etapasAtrasadas.length > 0 ? (
              <p className="mt-1 flex items-center gap-1 text-lg font-bold text-danger">
                <AlertTriangle className="h-4 w-4" />
                {etapasAtrasadas.length} etapa(s) · {totalAtraso}d
              </p>
            ) : (
              <p className="mt-1 text-lg font-bold text-success">Em dia</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orçado × Realizado */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Orçado × Realizado</h2>
        <Card className={estouro ? "border-danger/40" : ""}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted">Orçado</p>
                <p className="text-xl font-bold text-foreground">{formatarMoeda(orcado || null)}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Realizado ({obra.recibos.length} recibo(s))</p>
                <p className="text-xl font-bold text-foreground">{formatarMoeda(realizado)}</p>
              </div>
              <div>
                <p className="text-sm text-muted">{estouro ? "Estouro" : "Saldo"}</p>
                <p className={`text-xl font-bold ${estouro ? "text-danger" : "text-success"}`}>
                  {formatarMoeda(Math.abs(saldo))}
                </p>
              </div>
            </div>

            {orcado > 0 && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>Consumo do orçamento</span>
                  <span>{pctConsumido}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={estouro ? "h-full bg-danger" : "h-full bg-primary"}
                    style={{ width: `${Math.min(100, pctConsumido)}%` }}
                  />
                </div>
                {estouro && (
                  <p className="mt-2 flex items-center gap-1 text-sm font-medium text-danger">
                    <AlertTriangle className="h-4 w-4" />
                    Orçamento estourado em {formatarMoeda(realizado - orcado)} ({pctConsumido}%).
                  </p>
                )}
              </div>
            )}

            {obra.recibos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="py-1.5">Data</th>
                      <th className="py-1.5">Categoria</th>
                      <th className="py-1.5">Fornecedor</th>
                      <th className="py-1.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obra.recibos.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-1.5">{formatarData(r.dataEmissao)}</td>
                        <td className="py-1.5">{r.categoria}</td>
                        <td className="py-1.5">{r.fornecedor?.nome ?? "—"}</td>
                        <td className="py-1.5 text-right font-medium">{formatarMoeda(r.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Nenhum recibo vinculado. Em <strong>Recibos</strong>, selecione esta obra no campo
                “Vincular a uma obra” para compor o realizado.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cronograma (Gantt) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Cronograma</h2>
        <Gantt etapas={obra.etapas} />
      </div>

      {/* Etapas */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Etapas</h2>
        {editavel && (
          <Modal
            title="Nova etapa"
            trigger={
              <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                <Plus className="h-4 w-4" /> Nova etapa
              </span>
            }
          >
            <EtapaForm
              action={criarEtapa}
              obraId={obra.id}
              proximaOrdem={obra.etapas.length + 1}
            />
          </Modal>
        )}
      </div>

      {obra.etapas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
          Nenhuma etapa cadastrada.
        </p>
      ) : (
        <div className="space-y-4">
          {obra.etapas.map((e) => {
            const atrasada = etapaAtrasada(e, hoje);
            const statusEtapa = statusCalculadoEtapa(e, hoje);
            const temSubs = e.subEtapas.length > 0;
            const feitas = e.subEtapas.filter((s) => s.status === "CONCLUIDA").length;
            return (
              <Card key={e.id}>
                <CardContent className="space-y-3">
                  {/* Cabeçalho da etapa */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{e.nome}</span>
                        <Badge tone={STATUS_OBRA_TONE[statusEtapa]}>
                          {STATUS_OBRA_LABEL[statusEtapa]}
                          {atrasada ? ` +${diasAtraso(e, hoje)}d` : ""}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {formatarData(e.inicioPrev)} – {formatarData(e.fimPrev)}
                        {temSubs ? ` · ${feitas}/${e.subEtapas.length} sub-etapas` : ""}
                      </p>
                    </div>
                    {editavel && (
                      <div className="flex items-center gap-1">
                        <Modal
                          title="Nova sub-etapa"
                          trigger={
                            <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-muted">
                              <Plus className="h-4 w-4" /> Sub-etapa
                            </span>
                          }
                        >
                          <SubEtapaForm
                            action={criarSubEtapa}
                            etapaId={e.id}
                            obraId={obra.id}
                            proximaOrdem={e.subEtapas.length + 1}
                          />
                        </Modal>
                        <Modal
                          title="Editar etapa"
                          trigger={
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-muted">
                              <Pencil className="h-4 w-4" />
                            </span>
                          }
                        >
                          <EtapaForm
                            action={atualizarEtapa}
                            etapa={e}
                            obraId={obra.id}
                            temSubEtapas={temSubs}
                          />
                        </Modal>
                        <form action={excluirEtapa}>
                          <input type="hidden" name="obraId" value={obra.id} />
                          <input type="hidden" name="id" value={e.id} />
                          <ConfirmSubmit />
                        </form>
                      </div>
                    )}
                  </div>

                  {/* Barra de progresso */}
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={atrasada ? "h-full bg-danger" : "h-full bg-primary"}
                        style={{ width: `${e.progresso}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted">{e.progresso}%</span>
                  </div>

                  {/* Sub-etapas */}
                  {temSubs && (
                    <ul className="divide-y divide-border border-t border-border">
                      {e.subEtapas.map((s) => {
                        const concluida = s.status === "CONCLUIDA";
                        return (
                          <li key={s.id} className="flex items-center gap-2 py-2">
                            {editavel ? (
                              <form action={alternarSubEtapa}>
                                <input type="hidden" name="id" value={s.id} />
                                <input type="hidden" name="obraId" value={obra.id} />
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
                              {s.titulo}
                            </span>
                            <Badge tone={STATUS_SUBOS_TONE[s.status]}>
                              {STATUS_SUBOS_LABEL[s.status]}
                            </Badge>
                            {editavel && (
                              <>
                                <Modal
                                  title="Editar sub-etapa"
                                  trigger={
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-muted">
                                      <Pencil className="h-4 w-4" />
                                    </span>
                                  }
                                >
                                  <SubEtapaForm
                                    action={atualizarSubEtapa}
                                    sub={s}
                                    etapaId={e.id}
                                    obraId={obra.id}
                                  />
                                </Modal>
                                <form action={excluirSubEtapa}>
                                  <input type="hidden" name="id" value={s.id} />
                                  <input type="hidden" name="obraId" value={obra.id} />
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
            );
          })}
        </div>
      )}
    </div>
  );
}
