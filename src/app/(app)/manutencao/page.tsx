import Link from "next/link";
import { Plus, Pencil, Wrench, ArrowRight } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { podeEditar } from "@/lib/permissoes";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Filtros } from "@/components/ui/filtros";
import { Paginacao } from "@/components/ui/paginacao";
import { DeleteButton } from "@/components/delete-button";
import { OSForm } from "@/components/forms/os-form";
import { criarOS, atualizarOS, excluirOS } from "@/app/actions/manutencao";
import { formatarData } from "@/lib/utils";
import { lerPagina, par, type SP } from "@/lib/listagem";
import {
  statusCalculadoOS,
  progressoOS,
  TIPOS_MANUTENCAO,
  STATUS_OS_LABEL,
  STATUS_OS_TONE,
  PRIORIDADE_LABEL,
  PRIORIDADE_TONE,
} from "@/lib/manutencao";

export default async function ManutencaoPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  const editavel = podeEditar(session?.user.papel);

  const sp = await searchParams;
  const busca = par(sp, "busca");
  const tipoF = par(sp, "tipo");
  const prioridadeF = par(sp, "prioridade");
  const { pagina, skip, take } = lerPagina(sp);

  const where: Prisma.OrdemServicoWhereInput = {
    ...(tipoF ? { tipo: tipoF } : {}),
    ...(prioridadeF === "BAIXA" || prioridadeF === "MEDIA" || prioridadeF === "ALTA" || prioridadeF === "URGENTE"
      ? { prioridade: prioridadeF }
      : {}),
    ...(busca
      ? {
          OR: [
            { titulo: { contains: busca } },
            { local: { contains: busca } },
            { descricao: { contains: busca } },
          ],
        }
      : {}),
  };

  const [ordens, totalCount, fornecedores, responsaveis] = await Promise.all([
    prisma.ordemServico.findMany({
      where,
      orderBy: [{ status: "asc" }, { numero: "desc" }],
      skip,
      take,
      include: {
        subOrdens: { select: { status: true } },
        responsavel: { select: { nome: true } },
        fornecedor: { select: { nome: true } },
      },
    }),
    prisma.ordemServico.count({ where }),
    prisma.fornecedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.user.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  const hoje = new Date();
  const temFiltro = Boolean(busca || tipoF || prioridadeF);

  return (
    <div>
      <PageHeader
        titulo="Manutenção"
        descricao="Ordens de Serviço (OS) e sub-OS de manutenção do condomínio."
        acao={
          editavel && (
            <Modal
              title="Nova Ordem de Serviço"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> Nova OS
                </span>
              }
            >
              <OSForm action={criarOS} fornecedores={fornecedores} responsaveis={responsaveis} />
            </Modal>
          )
        }
      />

      <Filtros buscaDefault={busca ?? ""} placeholder="Buscar por título, local ou descrição…">
        <Select name="tipo" defaultValue={tipoF ?? ""} className="w-auto">
          <option value="">Todos os tipos</option>
          {TIPOS_MANUTENCAO.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select name="prioridade" defaultValue={prioridadeF ?? ""} className="w-auto">
          <option value="">Todas prioridades</option>
          <option value="BAIXA">Baixa</option>
          <option value="MEDIA">Média</option>
          <option value="ALTA">Alta</option>
          <option value="URGENTE">Urgente</option>
        </Select>
      </Filtros>

      {totalCount === 0 ? (
        <EmptyState
          titulo={temFiltro ? "Nenhuma OS encontrada" : "Nenhuma Ordem de Serviço"}
          descricao={
            temFiltro
              ? "Tente ajustar a busca ou os filtros."
              : "Crie a primeira OS para registrar uma manutenção e suas sub-OS."
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>OS</TH>
              <TH>Título</TH>
              <TH>Tipo</TH>
              <TH>Prioridade</TH>
              <TH>Status</TH>
              <TH>Prazo</TH>
              <TH>Sub-OS</TH>
              {editavel && <TH className="text-right">Ações</TH>}
            </tr>
          </THead>
          <tbody>
            {ordens.map((os) => {
              const status = statusCalculadoOS(os.status, os.dataPrevista, os.subOrdens, hoje);
              const prog = progressoOS(os.subOrdens);
              const feitas = os.subOrdens.filter((s) => s.status === "CONCLUIDA").length;
              return (
                <TR key={os.id}>
                  <TD className="font-mono text-xs text-muted">#{os.numero}</TD>
                  <TD>
                    <Link
                      href={`/manutencao/${os.id}`}
                      className="flex items-center gap-2 font-medium hover:text-primary"
                    >
                      <Wrench className="h-4 w-4 text-muted" />
                      {os.titulo}
                    </Link>
                    {os.local && <span className="text-xs text-muted">{os.local}</span>}
                  </TD>
                  <TD>
                    <Badge tone="info">{os.tipo}</Badge>
                  </TD>
                  <TD>
                    <Badge tone={PRIORIDADE_TONE[os.prioridade]}>
                      {PRIORIDADE_LABEL[os.prioridade]}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge tone={STATUS_OS_TONE[status]}>{STATUS_OS_LABEL[status]}</Badge>
                  </TD>
                  <TD className="text-sm">{os.dataPrevista ? formatarData(os.dataPrevista) : "—"}</TD>
                  <TD>
                    {os.subOrdens.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-surface-muted">
                          <div className="h-full bg-primary" style={{ width: `${prog}%` }} />
                        </div>
                        <span className="text-xs text-muted">
                          {feitas}/{os.subOrdens.length}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </TD>
                  {editavel && (
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        <Modal
                          title={`Editar OS #${os.numero}`}
                          trigger={
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-muted">
                              <Pencil className="h-4 w-4" />
                            </span>
                          }
                        >
                          <OSForm
                            action={atualizarOS}
                            os={os}
                            fornecedores={fornecedores}
                            responsaveis={responsaveis}
                          />
                        </Modal>
                        <DeleteButton action={excluirOS} id={os.id} />
                      </div>
                    </TD>
                  )}
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}

      <Paginacao basePath="/manutencao" sp={sp} pagina={pagina} total={totalCount} />
    </div>
  );
}
