import { Plus, Pencil, CalendarDays, MapPin, User2, Clock } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Filtros } from "@/components/ui/filtros";
import { Paginacao } from "@/components/ui/paginacao";
import { DeleteButton } from "@/components/delete-button";
import { EventoForm } from "@/components/forms/evento-form";
import { criarEvento, atualizarEvento, excluirEvento } from "@/app/actions/eventos";
import { formatarData } from "@/lib/utils";
import { lerPagina, par, type SP } from "@/lib/listagem";
import {
  statusCalculadoEvento,
  TIPOS_EVENTO,
  LOCAIS_EVENTO,
  STATUS_EVENTO_LABEL,
  STATUS_EVENTO_TONE,
} from "@/lib/eventos";

function hora(d: Date) {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  const editavel = podeEditar(session?.user.papel);

  const sp = await searchParams;
  const busca = par(sp, "busca");
  const tipoF = par(sp, "tipo");
  const localF = par(sp, "local");
  const quando = par(sp, "quando") ?? "proximos";
  const { pagina, skip, take } = lerPagina(sp);
  const hoje = new Date();

  const where: Prisma.EventoWhereInput = {
    ...(tipoF ? { tipo: tipoF } : {}),
    ...(localF ? { local: localF } : {}),
    ...(quando === "proximos" ? { dataFim: { gte: hoje } } : {}),
    ...(quando === "passados" ? { dataFim: { lt: hoje } } : {}),
    ...(busca
      ? {
          OR: [
            { titulo: { contains: busca } },
            { local: { contains: busca } },
            { reservante: { contains: busca } },
            { descricao: { contains: busca } },
          ],
        }
      : {}),
  };

  const ordem: Prisma.EventoOrderByWithRelationInput =
    quando === "passados" ? { dataInicio: "desc" } : { dataInicio: "asc" };

  const [eventos, totalCount, responsaveis] = await Promise.all([
    prisma.evento.findMany({
      where,
      orderBy: ordem,
      skip,
      take,
      include: { responsavel: { select: { nome: true } } },
    }),
    prisma.evento.count({ where }),
    prisma.user.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  const temFiltro = Boolean(busca || tipoF || localF || quando !== "proximos");

  // Agrupa por dia (agenda)
  let ultimoDia = "";

  return (
    <div>
      <PageHeader
        titulo="Eventos"
        descricao="Agenda do condomínio e reservas de espaços comuns."
        acao={
          editavel && (
            <Modal
              title="Novo evento"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> Novo evento
                </span>
              }
            >
              <EventoForm action={criarEvento} responsaveis={responsaveis} />
            </Modal>
          )
        }
      />

      <Filtros buscaDefault={busca ?? ""} placeholder="Buscar por título, local ou reservante…">
        <Select name="quando" defaultValue={quando} className="w-auto">
          <option value="proximos">Próximos</option>
          <option value="passados">Passados</option>
          <option value="todos">Todos</option>
        </Select>
        <Select name="tipo" defaultValue={tipoF ?? ""} className="w-auto">
          <option value="">Todos os tipos</option>
          {TIPOS_EVENTO.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select name="local" defaultValue={localF ?? ""} className="w-auto">
          <option value="">Todos os locais</option>
          {LOCAIS_EVENTO.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      </Filtros>

      {totalCount === 0 ? (
        <EmptyState
          titulo={temFiltro ? "Nenhum evento encontrado" : "Nenhum evento agendado"}
          descricao={
            temFiltro
              ? "Tente ajustar a busca ou os filtros."
              : "Crie o primeiro evento ou reserva de espaço do condomínio."
          }
        />
      ) : (
        <div className="space-y-3">
          {eventos.map((e) => {
            const status = statusCalculadoEvento(e.status, e.dataInicio, e.dataFim, hoje);
            const dia = formatarData(e.dataInicio);
            const mostrarDia = dia !== ultimoDia;
            ultimoDia = dia;
            const mesmoDia = formatarData(e.dataFim) === dia;
            return (
              <div key={e.id}>
                {mostrarDia && (
                  <div className="mb-2 mt-4 flex items-center gap-2 text-sm font-semibold text-muted">
                    <CalendarDays className="h-4 w-4" /> {dia}
                  </div>
                )}
                <Card>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{e.titulo}</span>
                        <Badge tone="info">{e.tipo}</Badge>
                        <Badge tone={STATUS_EVENTO_TONE[status]}>{STATUS_EVENTO_LABEL[status]}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {hora(e.dataInicio)}
                          {mesmoDia ? `–${hora(e.dataFim)}` : ` → ${formatarData(e.dataFim)} ${hora(e.dataFim)}`}
                        </span>
                        {e.local && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {e.local}
                          </span>
                        )}
                        {(e.responsavel?.nome || e.reservante) && (
                          <span className="inline-flex items-center gap-1">
                            <User2 className="h-3.5 w-3.5" />
                            {e.reservante ?? e.responsavel?.nome}
                          </span>
                        )}
                      </div>
                      {e.descricao && <p className="mt-1 text-sm text-muted">{e.descricao}</p>}
                    </div>
                    {editavel && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Modal
                          title="Editar evento"
                          trigger={
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-muted">
                              <Pencil className="h-4 w-4" />
                            </span>
                          }
                        >
                          <EventoForm action={atualizarEvento} evento={e} responsaveis={responsaveis} />
                        </Modal>
                        <DeleteButton action={excluirEvento} id={e.id} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Paginacao basePath="/eventos" sp={sp} pagina={pagina} total={totalCount} />
    </div>
  );
}
