import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings, Sparkles, Plus, MessageSquare, Trash2 } from "lucide-react";
import { auth } from "@/auth";
import { podeUsarAssistente } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { getConfiguracao, provedoresDisponiveis, PROVEDOR_LABEL } from "@/lib/config";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { AssistenteChat } from "@/components/assistente-chat";
import { excluirConversa } from "@/app/actions/conversas";
import { cn } from "@/lib/utils";

export default async function AssistentePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const session = await auth();
  if (!podeUsarAssistente(session?.user.papel, session?.user.podeUsarIA)) redirect("/");

  const { c } = await searchParams;
  const config = await getConfiguracao();
  const disp = provedoresDisponiveis(config);
  const disponiveis = (["claude", "gemini", "openai"] as const)
    .filter((p) => disp[p])
    .map((p) => ({ provedor: p, label: PROVEDOR_LABEL[p] }));

  const conversas = await prisma.conversa.findMany({
    where: { criadoPorId: session!.user.id },
    orderBy: { atualizadoEm: "desc" },
    select: { id: true, titulo: true },
  });

  const conversaAtual =
    c != null
      ? await prisma.conversa.findFirst({
          where: { id: c, criadoPorId: session!.user.id },
          include: { mensagens: { orderBy: { criadoEm: "asc" } } },
        })
      : null;

  const mensagensIniciais =
    conversaAtual?.mensagens.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      arquivoUrl: m.arquivoUrl ?? undefined,
    })) ?? [];

  return (
    <div>
      <PageHeader
        titulo="Assistente IA"
        descricao={`Tire dúvidas e peça análises sobre o condomínio ${config.nomeCondominio}.`}
        acao={
          <Link href="/configuracoes">
            <Button variant="outline">
              <Settings className="h-4 w-4" /> Configurar IAs
            </Button>
          </Link>
        }
      />

      {disponiveis.length === 0 ? (
        <EmptyState
          titulo="Nenhuma IA configurada"
          descricao="Cadastre ao menos uma chave de API (Claude, Gemini ou ChatGPT) nas configurações para usar o assistente."
          acao={
            <Link href="/configuracoes">
              <Button>
                <Sparkles className="h-4 w-4" /> Ir para Configurações
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* Histórico de conversas */}
          <aside className="space-y-2">
            <Link href="/assistente" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="h-4 w-4" /> Nova conversa
              </Button>
            </Link>
            <div className="space-y-1">
              {conversas.length === 0 && (
                <p className="px-2 py-3 text-xs text-muted">Nenhuma conversa salva ainda.</p>
              )}
              {conversas.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg pr-1",
                    conv.id === c ? "bg-primary/10" : "hover:bg-surface-muted"
                  )}
                >
                  <Link
                    href={`/assistente?c=${conv.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-sm"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted" />
                    <span className="truncate">{conv.titulo}</span>
                  </Link>
                  <form action={excluirConversa}>
                    <input type="hidden" name="id" value={conv.id} />
                    <button
                      type="submit"
                      title="Excluir conversa"
                      className="rounded p-1 text-muted opacity-0 hover:text-danger group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </aside>

          {/* Chat */}
          <AssistenteChat
            key={conversaAtual?.id ?? "nova"}
            disponiveis={disponiveis}
            conversaIdInicial={conversaAtual?.id ?? null}
            mensagensIniciais={mensagensIniciais}
          />
        </div>
      )}
    </div>
  );
}
