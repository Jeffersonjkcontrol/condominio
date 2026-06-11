import { redirect } from "next/navigation";
import { Plus, Pencil, UserCircle2, Bell, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ehAdmin, PAPEL_LABEL } from "@/lib/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Filtros } from "@/components/ui/filtros";
import { Paginacao } from "@/components/ui/paginacao";
import { DeleteButton } from "@/components/delete-button";
import { UsuarioForm } from "@/components/forms/usuario-form";
import { criarUsuario, atualizarUsuario, excluirUsuario } from "@/app/actions/usuarios";
import { formatarData } from "@/lib/utils";
import { lerPagina, par, type SP } from "@/lib/listagem";
import { EmptyState } from "@/components/ui/page-header";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  if (!ehAdmin(session?.user.papel)) redirect("/");

  const sp = await searchParams;
  const busca = par(sp, "busca");
  const { pagina, skip, take } = lerPagina(sp);

  const where = busca
    ? { OR: [{ nome: { contains: busca } }, { email: { contains: busca } }] }
    : {};

  const [usuarios, totalCount] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { nome: "asc" }, skip, take }),
    prisma.user.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Usuários"
        descricao="Gerencie os acessos e permissões do sistema."
        acao={
          <Modal
            title="Novo usuário"
            trigger={
              <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                <Plus className="h-4 w-4" /> Novo usuário
              </span>
            }
          >
            <UsuarioForm action={criarUsuario} />
          </Modal>
        }
      />

      <Filtros buscaDefault={busca ?? ""} placeholder="Buscar por nome ou e-mail…" />

      {totalCount === 0 ? (
        <EmptyState titulo="Nenhum usuário encontrado" descricao="Tente ajustar a busca." />
      ) : (
      <Table>
        <THead>
          <tr>
            <TH>Nome</TH>
            <TH>E-mail</TH>
            <TH>Papel</TH>
            <TH>Status</TH>
            <TH>Criado em</TH>
            <TH className="text-right">Ações</TH>
          </tr>
        </THead>
        <tbody>
          {usuarios.map((u) => (
            <TR key={u.id}>
              <TD>
                <div className="flex items-center gap-2 font-medium">
                  <UserCircle2 className="h-4 w-4 text-muted" />
                  {u.nome}
                  {u.id === session?.user.id && (
                    <span className="text-xs text-muted">(você)</span>
                  )}
                </div>
              </TD>
              <TD className="text-sm">{u.email}</TD>
              <TD>
                <Badge tone={u.papel === "ADMIN" ? "info" : "default"}>
                  {PAPEL_LABEL[u.papel]}
                </Badge>
              </TD>
              <TD>
                <div className="flex flex-wrap items-center gap-1">
                  {u.ativo ? (
                    <Badge tone="success">Ativo</Badge>
                  ) : (
                    <Badge tone="danger">Inativo</Badge>
                  )}
                  {u.recebeNotificacoes && (
                    <Badge tone="info" className="inline-flex items-center gap-1">
                      <Bell className="h-3 w-3" /> Notif.
                    </Badge>
                  )}
                  {(u.podeUsarIA || u.papel === "ADMIN") && (
                    <Badge tone="info" className="inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> IA
                    </Badge>
                  )}
                </div>
              </TD>
              <TD className="text-sm text-muted">{formatarData(u.criadoEm)}</TD>
              <TD>
                <div className="flex items-center justify-end gap-1">
                  <Modal
                    title="Editar usuário"
                    trigger={
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-muted">
                        <Pencil className="h-4 w-4" />
                      </span>
                    }
                  >
                    <UsuarioForm action={atualizarUsuario} usuario={u} />
                  </Modal>
                  {u.id !== session?.user.id && (
                    <DeleteButton action={excluirUsuario} id={u.id} />
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
      )}

      <Paginacao basePath="/usuarios" sp={sp} pagina={pagina} total={totalCount} />
    </div>
  );
}
