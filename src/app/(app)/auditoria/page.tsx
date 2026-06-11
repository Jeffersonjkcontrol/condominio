import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ehAdmin } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Filtros } from "@/components/ui/filtros";
import { Paginacao } from "@/components/ui/paginacao";
import { formatarDataHora } from "@/lib/utils";
import { ACAO_LABEL, ACAO_TONE } from "@/lib/auditoria";
import { lerPagina, par, type SP } from "@/lib/listagem";

const ENTIDADES = [
  "OS",
  "Sub-OS",
  "Recibo",
  "Obra",
  "Etapa",
  "Fornecedor",
  "Serviço",
  "Usuário",
  "Configuração",
];

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  if (!ehAdmin(session?.user.papel)) redirect("/");

  const sp = await searchParams;
  const busca = par(sp, "busca");
  const entidade = par(sp, "entidade");
  const { pagina, skip, take } = lerPagina(sp);

  const where = {
    ...(entidade ? { entidade } : {}),
    ...(busca
      ? { OR: [{ detalhe: { contains: busca } }, { usuarioNome: { contains: busca } }] }
      : {}),
  };

  const [registros, totalCount] = await Promise.all([
    prisma.auditoria.findMany({ where, orderBy: { criadoEm: "desc" }, skip, take }),
    prisma.auditoria.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Auditoria"
        descricao="Rastreabilidade de todos os processos — quem fez o quê e quando."
      />

      <Filtros buscaDefault={busca ?? ""} placeholder="Buscar por detalhe ou usuário…">
        <Select name="entidade" defaultValue={entidade ?? ""} className="w-auto">
          <option value="">Todos os tipos</option>
          {ENTIDADES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
      </Filtros>

      {totalCount === 0 ? (
        <EmptyState
          titulo="Nenhum registro de auditoria"
          descricao="As ações realizadas no sistema aparecerão aqui."
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Quando</TH>
              <TH>Usuário</TH>
              <TH>Ação</TH>
              <TH>Tipo</TH>
              <TH>Detalhe</TH>
            </tr>
          </THead>
          <tbody>
            {registros.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap text-sm text-muted">
                  {formatarDataHora(r.criadoEm)}
                </TD>
                <TD className="font-medium">{r.usuarioNome}</TD>
                <TD>
                  <Badge tone={ACAO_TONE[r.acao] ?? "default"}>
                    {ACAO_LABEL[r.acao] ?? r.acao}
                  </Badge>
                </TD>
                <TD>
                  <span className="text-sm text-muted">{r.entidade}</span>
                </TD>
                <TD className="text-sm">{r.detalhe ?? "—"}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Paginacao basePath="/auditoria" sp={sp} pagina={pagina} total={totalCount} />
    </div>
  );
}
