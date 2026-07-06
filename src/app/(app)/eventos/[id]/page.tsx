import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  CalendarRange,
  MapPin,
  User2,
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
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EventoForm } from "@/components/forms/evento-form";
import { EtapaEventoForm } from "@/components/forms/etapa-evento-form";
import {
  atualizarEvento,
  excluirEvento,
  criarEtapaEvento,
  atualizarEtapaEvento,
  alternarEtapaEvento,
  excluirEtapaEvento,
} from "@/app/actions/eventos";
import { STATUS_SUBOS_LABEL, STATUS_SUBOS_TONE } from "@/lib/manutencao";
import {
  statusCalculadoEvento,
  STATUS_EVENTO_LABEL,
  STATUS_EVENTO_TONE,
} from "@/lib/eventos";
import { formatarDataHora } from "@/lib/utils";

export default async function EventoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const editavel = podeEditar(session?.user.papel);

  const [evento, responsaveis] = await Promise.all([
    prisma.evento.findUnique({
      where: { id },
      include: {
        etapas: { orderBy: { ordem: "asc" } },
        responsavel: { select: { nome: true } },
      },
    }),
    prisma.user.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);
  if (!evento) notFound();

  const hoje = new Date();
  const status = statusCalculadoEvento(evento.status, evento.dataInicio, evento.dataFim, hoje);

  const totalEtapas = evento.etapas.length;
  const feitas = evento.etapas.filter((e) => e.status === "CONCLUIDA").length;
  const progresso = totalEtapas > 0 ? Math.round((feitas / totalEtapas) * 100) : 0;

  return (
    <div className="space-y-6">
      <Link
        href="/eventos"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{evento.titulo}</h1>
            <Badge tone="info">{evento.tipo}</Badge>
            <Badge tone={STATUS_EVENTO_TONE[status]}>{STATUS_EVENTO_LABEL[status]}</Badge>
          </div>
          {evento.descricao && <p className="mt-1 text-sm text-muted">{evento.descricao}</p>}
        </div>
        {editavel && (
          <div className="flex items-center gap-2">
            <Modal
              title="Editar evento"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted">
                  <Pencil className="h-4 w-4" /> Editar
                </span>
              }
            >
              <EventoForm action={atualizarEvento} evento={evento} responsaveis={responsaveis} />
            </Modal>
            <form action={excluirEvento}>
              <input type="hidden" name="id" value={evento.id} />
              <input type="hidden" name="redirecionar" value="1" />
              <ConfirmSubmit confirmacao="Excluir este evento? Esta ação não pode ser desfeita." />
            </form>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Quando</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium">
              <CalendarRange className="h-4 w-4 text-muted" />
              {formatarDataHora(evento.dataInicio)} – {formatarDataHora(evento.dataFim)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Local</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium">
              <MapPin className="h-4 w-4 text-muted" /> {evento.local ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Responsável / Reservante</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium">
              <User2 className="h-4 w-4 text-muted" />
              {evento.responsavel?.nome ?? evento.reservante ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Etapas do evento (preparação) */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ListChecks className="h-5 w-5 text-primary" /> Etapas do evento
          </h2>
          {editavel && (
            <Modal
              title="Nova etapa do evento"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> Nova etapa
                </span>
              }
            >
              <EtapaEventoForm
                action={criarEtapaEvento}
                eventoId={evento.id}
                proximaOrdem={totalEtapas + 1}
              />
            </Modal>
          )}
        </div>

        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              Organize a preparação do evento em etapas até o dia. Marque cada etapa concluída e o
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
                {evento.etapas.map((e) => {
                  const concluida = e.status === "CONCLUIDA";
                  return (
                    <li key={e.id} className="flex items-center gap-2 py-2">
                      {editavel ? (
                        <form action={alternarEtapaEvento}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="eventoId" value={evento.id} />
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
                            <EtapaEventoForm
                              action={atualizarEtapaEvento}
                              etapa={e}
                              eventoId={evento.id}
                            />
                          </Modal>
                          <form action={excluirEtapaEvento}>
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="eventoId" value={evento.id} />
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
    </div>
  );
}
