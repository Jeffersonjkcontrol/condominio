import Link from "next/link";
import {
  ListChecks,
  CheckCircle2,
  Circle,
  ArrowRight,
  HardHat,
  Hammer,
  Wrench,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { par, type SP } from "@/lib/listagem";
import { alternarSubEtapa } from "@/app/actions/obras";
import { alternarSubOS } from "@/app/actions/manutencao";
import { alternarEtapaServico } from "@/app/actions/fornecedores";
import { alternarEtapaEvento } from "@/app/actions/eventos";

type Tipo = "Obra" | "Manutenção" | "Serviço" | "Evento";

type Item = {
  id: string;
  titulo: string;
  status: string;
  tipo: Tipo;
  paiLabel: string;
  paiHref: string;
  acao: (formData: FormData) => void;
  campoPai: string;
  valorPai: string;
  responsavelId: string | null;
};

const SECOES: { tipo: Tipo; icon: LucideIcon }[] = [
  { tipo: "Obra", icon: HardHat },
  { tipo: "Manutenção", icon: Hammer },
  { tipo: "Serviço", icon: Wrench },
  { tipo: "Evento", icon: CalendarDays },
];

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  const editavel = podeEditar(session?.user.papel);
  const uid = session?.user.id ?? "";

  const sp = await searchParams;
  const soPendentes = (par(sp, "status") ?? "pendentes") !== "todas";
  const minhas = par(sp, "escopo") === "minhas";

  const statusW = soPendentes ? { status: { not: "CONCLUIDA" as const } } : {};

  const [subEtapas, subOS, etapasServico, etapasEvento] = await Promise.all([
    prisma.subEtapa.findMany({
      where: statusW,
      include: { etapa: { include: { obra: { select: { id: true, titulo: true, responsavelId: true } } } } },
      orderBy: { ordem: "asc" },
    }),
    prisma.subOrdemServico.findMany({
      where: statusW,
      include: { os: { select: { id: true, numero: true, titulo: true, responsavelId: true } } },
      orderBy: { ordem: "asc" },
    }),
    prisma.etapaServico.findMany({
      where: statusW,
      include: { servico: { select: { id: true, nome: true } } },
      orderBy: { ordem: "asc" },
    }),
    prisma.etapaEvento.findMany({
      where: statusW,
      include: { evento: { select: { id: true, titulo: true, responsavelId: true } } },
      orderBy: { ordem: "asc" },
    }),
  ]);

  const itens: Item[] = [
    ...subEtapas.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      status: s.status,
      tipo: "Obra" as const,
      paiLabel: s.etapa.obra.titulo,
      paiHref: `/obras/${s.etapa.obra.id}`,
      acao: alternarSubEtapa,
      campoPai: "obraId",
      valorPai: s.etapa.obra.id,
      responsavelId: s.etapa.obra.responsavelId,
    })),
    ...subOS.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      status: s.status,
      tipo: "Manutenção" as const,
      paiLabel: `OS #${s.os.numero} — ${s.os.titulo}`,
      paiHref: `/manutencao/${s.os.id}`,
      acao: alternarSubOS,
      campoPai: "ordemId",
      valorPai: s.os.id,
      responsavelId: s.os.responsavelId,
    })),
    ...etapasServico.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      status: s.status,
      tipo: "Serviço" as const,
      paiLabel: s.servico.nome,
      paiHref: `/servicos/${s.servico.id}`,
      acao: alternarEtapaServico,
      campoPai: "servicoId",
      valorPai: s.servico.id,
      responsavelId: null,
    })),
    ...etapasEvento.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      status: s.status,
      tipo: "Evento" as const,
      paiLabel: s.evento.titulo,
      paiHref: `/eventos/${s.evento.id}`,
      acao: alternarEtapaEvento,
      campoPai: "eventoId",
      valorPai: s.evento.id,
      responsavelId: s.evento.responsavelId,
    })),
  ];

  const filtrados = minhas ? itens.filter((i) => i.responsavelId === uid) : itens;

  return (
    <div>
      <PageHeader
        titulo="Tarefas"
        descricao="Todas as etapas e sub-tarefas pendentes do condomínio em um só lugar."
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="status" defaultValue={soPendentes ? "pendentes" : "todas"} className="w-auto">
          <option value="pendentes">Pendentes</option>
          <option value="todas">Todas</option>
        </Select>
        <Select name="escopo" defaultValue={minhas ? "minhas" : "todas"} className="w-auto">
          <option value="todas">De todos</option>
          <option value="minhas">Minhas (sou responsável)</option>
        </Select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {filtrados.length === 0 ? (
        <EmptyState
          titulo={soPendentes ? "Tudo em dia! ✅" : "Nenhuma tarefa encontrada"}
          descricao={
            soPendentes
              ? "Não há etapas pendentes com esse filtro."
              : "Ajuste os filtros para ver as tarefas."
          }
        />
      ) : (
        <div className="space-y-6">
          {SECOES.map(({ tipo, icon: Icon }) => {
            const doTipo = filtrados.filter((i) => i.tipo === tipo);
            if (doTipo.length === 0) return null;
            return (
              <div key={tipo}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
                  <Icon className="h-4 w-4" /> {tipo} · {doTipo.length}
                </h2>
                <Card>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-border">
                      {doTipo.map((i) => {
                        const concluida = i.status === "CONCLUIDA";
                        return (
                          <li key={`${i.tipo}-${i.id}`} className="flex items-center gap-3 px-4 py-3">
                            {editavel ? (
                              <form action={i.acao}>
                                <input type="hidden" name="id" value={i.id} />
                                <input type="hidden" name={i.campoPai} value={i.valorPai} />
                                <button
                                  type="submit"
                                  title={concluida ? "Reabrir" : "Concluir"}
                                  className="flex h-7 w-7 items-center justify-center text-muted hover:text-primary"
                                >
                                  {concluida ? (
                                    <CheckCircle2 className="h-6 w-6 text-success" />
                                  ) : (
                                    <Circle className="h-6 w-6" />
                                  )}
                                </button>
                              </form>
                            ) : concluida ? (
                              <CheckCircle2 className="h-6 w-6 text-success" />
                            ) : (
                              <Circle className="h-6 w-6 text-muted" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate text-sm font-medium ${
                                  concluida ? "text-muted line-through" : "text-foreground"
                                }`}
                              >
                                {i.titulo}
                              </p>
                              <Link
                                href={i.paiHref}
                                className="group inline-flex items-center gap-1 truncate text-xs text-muted hover:text-primary"
                              >
                                {i.paiLabel}
                                <ArrowRight className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
                              </Link>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
