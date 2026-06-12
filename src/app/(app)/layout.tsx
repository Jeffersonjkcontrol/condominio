import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/sidebar";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { PAPEL_LABEL, podeUsarAssistente } from "@/lib/permissoes";
import { getConfiguracao } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { statusCalculadoObra } from "@/lib/obras";
import { statusCalculadoOS } from "@/lib/manutencao";
import { gerarRecorrenciasPendentes } from "@/lib/recorrencias";
import { gerarNotificacoes } from "@/lib/notificacoes";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { name, papel } = session.user;
  const podeIA = podeUsarAssistente(papel, session.user.podeUsarIA);
  const config = await getConfiguracao();
  const nomeCondominio = config.nomeCondominio;

  // Lança automaticamente as contas fixas vencidas (throttled internamente).
  await gerarRecorrenciasPendentes();
  // Gera notificações dos alertas atuais para os destinatários (throttled).
  await gerarNotificacoes();

  // Notificações do usuário logado (para o sininho)
  const minhasNotificacoes = await prisma.notificacao.findMany({
    where: { usuarioId: session.user.id },
    orderBy: { criadoEm: "desc" },
    take: 30,
  });

  // Contadores de alerta para os badges do menu
  const [recibosPendentes, obras, ordens] = await Promise.all([
    prisma.recibo.count({ where: { status: "PENDENTE" } }),
    prisma.obra.findMany({ include: { etapas: true, recibos: { select: { valor: true } } } }),
    prisma.ordemServico.findMany({
      where: { status: { notIn: ["CONCLUIDA", "CANCELADA"] } },
      include: { subOrdens: { select: { status: true } } },
    }),
  ]);
  const hoje = new Date();
  const obrasAtencao = obras.filter((o) => {
    const st = statusCalculadoObra(o.status, o.dataInicioPrev, o.dataFimPrev, o.etapas, hoje);
    const realizado = o.recibos.reduce((s, r) => s + r.valor, 0);
    const estouro = (o.orcamento ?? 0) > 0 && realizado > (o.orcamento ?? 0);
    return st === "ATRASADA" || estouro;
  }).length;
  const manutencaoAtencao = ordens.filter(
    (o) => statusCalculadoOS(o.status, o.dataPrevista, o.subOrdens, hoje) === "ATRASADA"
  ).length;
  const alertas = {
    recibos: recibosPendentes,
    obras: obrasAtencao,
    manutencao: manutencaoAtencao,
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <BrandLogo logoData={config.logoData} nome={nomeCondominio} />
        </div>
        <Sidebar papel={papel} alertas={alertas} podeIA={podeIA} />
      </aside>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
          <div className="lg:hidden flex items-center gap-2">
            <BrandLogo logoData={config.logoData} nome={nomeCondominio} />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <NotificationBell
              notificacoes={minhasNotificacoes.map((n) => ({
                id: n.id,
                tipo: n.tipo,
                titulo: n.titulo,
                mensagem: n.mensagem,
                link: n.link,
                lida: n.lida,
                criadoEm: n.criadoEm.toISOString(),
              }))}
            />
            <ThemeToggle />
            <UserMenu
              nome={name ?? "Usuário"}
              papelLabel={PAPEL_LABEL[papel]}
            />
          </div>
        </header>

        {/* Navegação mobile */}
        <div className="border-b border-border bg-surface lg:hidden">
          <Sidebar papel={papel} alertas={alertas} podeIA={podeIA} />
        </div>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
