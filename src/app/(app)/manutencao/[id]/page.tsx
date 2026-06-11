import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, CheckCircle2, Circle, MapPin, CalendarClock, User2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { OSForm } from "@/components/forms/os-form";
import { SubOSForm } from "@/components/forms/subos-form";
import {
  atualizarOS,
  criarSubOS,
  atualizarSubOS,
  excluirSubOS,
  alternarSubOS,
} from "@/app/actions/manutencao";
import { formatarMoeda, formatarData, formatarDataHora } from "@/lib/utils";
import { ACAO_LABEL, ACAO_TONE } from "@/lib/auditoria";
import {
  statusCalculadoOS,
  progressoOS,
  STATUS_OS_LABEL,
  STATUS_OS_TONE,
  PRIORIDADE_LABEL,
  PRIORIDADE_TONE,
  STATUS_SUBOS_LABEL,
  STATUS_SUBOS_TONE,
} from "@/lib/manutencao";

export default async function OSDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const editavel = podeEditar(session?.user.papel);

  const [os, fornecedores, responsaveis, historico] = await Promise.all([
    prisma.ordemServico.findUnique({
      where: { id },
      include: {
        subOrdens: { orderBy: { ordem: "asc" } },
        responsavel: { select: { nome: true } },
        fornecedor: { select: { nome: true } },
      },
    }),
    prisma.fornecedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.user.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.auditoria.findMany({
      where: { entidadeId: id, entidade: { in: ["OS", "Sub-OS"] } },
      orderBy: { criadoEm: "desc" },
      take: 50,
    }),
  ]);
  if (!os) notFound();

  const hoje = new Date();
  const status = statusCalculadoOS(os.status, os.dataPrevista, os.subOrdens, hoje);
  const prog = progressoOS(os.subOrdens);
  const custoSubs = os.subOrdens.reduce((s, x) => s + (x.custo ?? 0), 0);
  const custoTotal = (os.custo ?? 0) + custoSubs;

  return (
    <div className="space-y-6">
      <Link
        href="/manutencao"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-muted">#{os.numero}</span>
            <h1 className="text-2xl font-bold text-foreground">{os.titulo}</h1>
            <Badge tone={STATUS_OS_TONE[status]}>{STATUS_OS_LABEL[status]}</Badge>
            <Badge tone={PRIORIDADE_TONE[os.prioridade]}>{PRIORIDADE_LABEL[os.prioridade]}</Badge>
            <Badge tone="info">{os.tipo}</Badge>
          </div>
          {os.descricao && <p className="mt-1 text-sm text-muted">{os.descricao}</p>}
        </div>
        {editavel && (
          <Modal
            title={`Editar OS #${os.numero}`}
            trigger={
              <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted">
                <Pencil className="h-4 w-4" /> Editar OS
              </span>
            }
          >
            <OSForm action={atualizarOS} os={os} fornecedores={fornecedores} responsaveis={responsaveis} />
          </Modal>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Local</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium">
              <MapPin className="h-4 w-4 text-muted" /> {os.local ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card className={status === "ATRASADA" ? "border-danger/40" : ""}>
          <CardContent>
            <p className="text-sm text-muted">Prazo</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium">
              <CalendarClock className="h-4 w-4 text-muted" />
              {os.dataPrevista ? formatarData(os.dataPrevista) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Responsável / Fornecedor</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium">
              <User2 className="h-4 w-4 text-muted" />
              {os.responsavel?.nome ?? os.fornecedor?.nome ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Custo total</p>
            <p className="mt-1 text-lg font-bold">{formatarMoeda(custoTotal || null)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progresso */}
      {os.subOrdens.length > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Progresso das sub-OS</span>
            <span>{prog}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full bg-primary" style={{ width: `${prog}%` }} />
          </div>
        </div>
      )}

      {/* Sub-OS */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Sub-OS</h2>
        {editavel && (
          <Modal
            title="Nova sub-OS"
            trigger={
              <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                <Plus className="h-4 w-4" /> Nova sub-OS
              </span>
            }
          >
            <SubOSForm action={criarSubOS} ordemId={os.id} proximaOrdem={os.subOrdens.length + 1} />
          </Modal>
        )}
      </div>

      {os.subOrdens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
          Nenhuma sub-OS. Divida a OS em tarefas menores para acompanhar o andamento.
        </p>
      ) : (
        <Table>
          <THead>
            <tr>
              {editavel && <TH className="w-10"></TH>}
              <TH>Sub-OS</TH>
              <TH>Status</TH>
              <TH>Custo</TH>
              {editavel && <TH className="text-right">Ações</TH>}
            </tr>
          </THead>
          <tbody>
            {os.subOrdens.map((sub) => (
              <TR key={sub.id}>
                {editavel && (
                  <TD>
                    <form action={alternarSubOS}>
                      <input type="hidden" name="id" value={sub.id} />
                      <input type="hidden" name="ordemId" value={os.id} />
                      <button type="submit" title="Marcar concluída/pendente" className="text-muted hover:text-success">
                        {sub.status === "CONCLUIDA" ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                    </form>
                  </TD>
                )}
                <TD>
                  <div className={`font-medium ${sub.status === "CONCLUIDA" ? "text-muted line-through" : ""}`}>
                    {sub.titulo}
                  </div>
                  {sub.descricao && <div className="text-xs text-muted">{sub.descricao}</div>}
                </TD>
                <TD>
                  <Badge tone={STATUS_SUBOS_TONE[sub.status]}>{STATUS_SUBOS_LABEL[sub.status]}</Badge>
                </TD>
                <TD>{formatarMoeda(sub.custo)}</TD>
                {editavel && (
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Modal
                        title="Editar sub-OS"
                        trigger={
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-muted">
                            <Pencil className="h-4 w-4" />
                          </span>
                        }
                      >
                        <SubOSForm action={atualizarSubOS} sub={sub} ordemId={os.id} />
                      </Modal>
                      <form action={excluirSubOS}>
                        <input type="hidden" name="ordemId" value={os.id} />
                        <input type="hidden" name="id" value={sub.id} />
                        <ConfirmSubmit />
                      </form>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {/* Histórico / rastreabilidade desta OS */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Histórico</h2>
        {historico.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
            Sem registros ainda.
          </p>
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-5">
            {historico.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={ACAO_TONE[h.acao] ?? "default"}>{ACAO_LABEL[h.acao] ?? h.acao}</Badge>
                  <span className="text-muted">{h.entidade}</span>
                  <span className="font-medium">{h.detalhe}</span>
                </div>
                <p className="text-xs text-muted">
                  {h.usuarioNome} · {formatarDataHora(h.criadoEm)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
