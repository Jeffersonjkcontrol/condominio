import { prisma } from "@/lib/prisma";

const ID = "default";

/** Retorna a configuração singleton, criando com os padrões se ainda não existir.
 *  Usa upsert (atômico) para evitar corrida quando várias renderizações concorrem. */
export async function getConfiguracao() {
  return prisma.configuracao.upsert({
    where: { id: ID },
    update: {},
    create: { id: ID },
  });
}

/** Quais provedores de IA têm chave configurada (para o seletor do chat). */
export function provedoresDisponiveis(config: {
  claudeApiKey: string | null;
  geminiApiKey: string | null;
  openaiApiKey: string | null;
}) {
  return {
    claude: Boolean(config.claudeApiKey),
    gemini: Boolean(config.geminiApiKey),
    openai: Boolean(config.openaiApiKey),
  };
}

export const PROVEDOR_LABEL: Record<string, string> = {
  claude: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
  openai: "ChatGPT (OpenAI)",
};
