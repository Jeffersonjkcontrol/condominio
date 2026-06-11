// Chamadas REST diretas aos provedores de IA (sem SDKs), com suporte a function calling
// para a ferramenta "gerar_relatorio". Executa apenas no servidor.

export type Mensagem = { role: "user" | "assistant"; content: string };
export type Provedor = "claude" | "gemini" | "openai";

export type EntradaRelatorio = { tipo: string; mesReferencia?: string };
/** Executor injetado pela rota: gera o PDF e devolve um resumo + a URL do arquivo. */
export type ExecutorRelatorio = (
  entrada: EntradaRelatorio
) => Promise<{ resultado: string; arquivoUrl?: string }>;

export type RespostaIA = { resposta: string; arquivoUrl?: string };

const PARAMETROS = {
  type: "object",
  properties: {
    tipo: {
      type: "string",
      enum: ["financeiro", "obras", "fornecedores", "geral", "manutencao", "auditoria"],
      description:
        "Tipo do relatório: financeiro (recibos/gastos), obras (cronograma e atrasos), manutencao (ordens de serviço), fornecedores, auditoria (rastreabilidade/quem fez o quê), geral (prestação de contas).",
    },
    mesReferencia: {
      type: "string",
      description: "Mês de referência no formato AAAA-MM. Opcional, usado apenas no relatório financeiro.",
    },
  },
  required: ["tipo"],
} as const;

const DESCRICAO_FERRAMENTA =
  "Gera um relatório do condomínio em PDF (financeiro, obras, fornecedores ou prestação de contas geral). Use quando o usuário pedir um relatório, PDF ou prestação de contas.";

async function erroLegivel(resp: Response, nome: string): Promise<string> {
  let detalhe = "";
  try {
    const j = await resp.json();
    detalhe = j?.error?.message ?? JSON.stringify(j).slice(0, 200);
  } catch {
    detalhe = await resp.text().catch(() => "");
  }
  if (resp.status === 429) {
    return `Limite/cota da API ${nome} atingido (429). Aguarde alguns segundos e tente de novo. Se persistir, troque o modelo em Configurações ou verifique a cota/cobrança do provedor. Detalhe: ${detalhe}`;
  }
  if (resp.status === 401 || resp.status === 403) {
    return `Chave da API ${nome} inválida ou sem permissão (${resp.status}). Confira a chave em Configurações. Detalhe: ${detalhe}`;
  }
  return `Erro na API ${nome} (${resp.status}): ${detalhe || "falha desconhecida"}`;
}

/** Extrai o tempo de espera sugerido (RetryInfo do Google ou header Retry-After) em ms. */
function extrairEspera(j: unknown, resp: Response): number {
  const retryAfter = resp.headers.get("retry-after");
  if (retryAfter && !Number.isNaN(Number(retryAfter))) return Number(retryAfter) * 1000;
  try {
    const detalhes = (j as { error?: { details?: { retryDelay?: string }[] } })?.error?.details ?? [];
    for (const d of detalhes) {
      if (d.retryDelay) {
        const seg = parseFloat(d.retryDelay);
        if (!Number.isNaN(seg)) return seg * 1000;
      }
    }
  } catch {}
  return 2000;
}

/** POST JSON com 1 retentativa automática em caso de 429 (limite de taxa). */
async function requisitar(
  url: string,
  init: RequestInit,
  nome: string,
  tentativa = 0
): Promise<Record<string, unknown>> {
  const resp = await fetch(url, init);
  if (resp.ok) return resp.json();

  // 429: tenta uma vez respeitando o tempo sugerido (limitado a 8s).
  if (resp.status === 429 && tentativa < 1) {
    let corpo: unknown = null;
    try {
      corpo = await resp.clone().json();
    } catch {}
    const espera = Math.min(extrairEspera(corpo, resp), 8000);
    await new Promise((r) => setTimeout(r, espera));
    return requisitar(url, init, nome, tentativa + 1);
  }
  throw new Error(await erroLegivel(resp, nome));
}

// ---------------- Claude ----------------
async function chamarClaude(
  apiKey: string,
  modelo: string,
  system: string,
  mensagens: Mensagem[],
  exec: ExecutorRelatorio
): Promise<RespostaIA> {
  const url = "https://api.anthropic.com/v1/messages";
  const headers = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  const tools = [{ name: "gerar_relatorio", description: DESCRICAO_FERRAMENTA, input_schema: PARAMETROS }];
  const msgs: unknown[] = mensagens.map((m) => ({ role: m.role, content: m.content }));

  const d1 = await requisitar(
    url,
    { method: "POST", headers, body: JSON.stringify({ model: modelo, max_tokens: 1024, system, tools, messages: msgs }) },
    "Claude"
  );

  const toolUse = ((d1.content as { type: string }[]) ?? []).find((c) => c.type === "tool_use") as
    | { id: string; input: EntradaRelatorio }
    | undefined;
  if (d1.stop_reason === "tool_use" && toolUse) {
    const { resultado, arquivoUrl } = await exec(toolUse.input);
    msgs.push({ role: "assistant", content: d1.content });
    msgs.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUse.id, content: resultado }],
    });
    const d2 = await requisitar(
      url,
      { method: "POST", headers, body: JSON.stringify({ model: modelo, max_tokens: 1024, system, tools, messages: msgs }) },
      "Claude"
    );
    return { resposta: textoClaude(d2), arquivoUrl };
  }

  return { resposta: textoClaude(d1) };
}

type ChatMsg = {
  content?: string | null;
  tool_calls?: { id: string; function: { arguments: string } }[];
};

type GeminiPart = { text?: string; functionCall?: { args?: unknown } };
type GeminiResp = { candidates?: { content?: { parts?: GeminiPart[] } }[] };

function textoClaude(d: Record<string, unknown>): string {
  const content = (d.content as { type: string; text?: string }[] | undefined) ?? [];
  return (
    content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim() || "(sem resposta)"
  );
}

// ---------------- OpenAI ----------------
async function chamarOpenAI(
  apiKey: string,
  modelo: string,
  system: string,
  mensagens: Mensagem[],
  exec: ExecutorRelatorio
): Promise<RespostaIA> {
  const url = "https://api.openai.com/v1/chat/completions";
  const headers = { "content-type": "application/json", authorization: `Bearer ${apiKey}` };
  const tools = [
    { type: "function", function: { name: "gerar_relatorio", description: DESCRICAO_FERRAMENTA, parameters: PARAMETROS } },
  ];
  const msgs: unknown[] = [{ role: "system", content: system }, ...mensagens];

  const d1 = await requisitar(
    url,
    { method: "POST", headers, body: JSON.stringify({ model: modelo, messages: msgs, tools }) },
    "ChatGPT"
  );
  const msg = (d1 as { choices?: { message?: ChatMsg }[] })?.choices?.[0]?.message;

  if (msg?.tool_calls?.length) {
    const tc = msg.tool_calls[0];
    let input: EntradaRelatorio = { tipo: "geral" };
    try {
      input = JSON.parse(tc.function.arguments || "{}");
    } catch {}
    const { resultado, arquivoUrl } = await exec(input);
    msgs.push(msg);
    msgs.push({ role: "tool", tool_call_id: tc.id, content: resultado });
    const d2 = await requisitar(
      url,
      { method: "POST", headers, body: JSON.stringify({ model: modelo, messages: msgs, tools }) },
      "ChatGPT"
    );
    const m2 = (d2 as { choices?: { message?: ChatMsg }[] })?.choices?.[0]?.message;
    return { resposta: m2?.content ?? "(sem resposta)", arquivoUrl };
  }

  return { resposta: msg?.content ?? "(sem resposta)" };
}

// ---------------- Gemini ----------------
async function chamarGemini(
  apiKey: string,
  modelo: string,
  system: string,
  mensagens: Mensagem[],
  exec: ExecutorRelatorio
): Promise<RespostaIA> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
  const tools = [{ functionDeclarations: [{ name: "gerar_relatorio", description: DESCRICAO_FERRAMENTA, parameters: PARAMETROS }] }];
  const contents: unknown[] = mensagens.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const base = { systemInstruction: { parts: [{ text: system }] }, tools };

  const d1 = await requisitar(
    url,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, contents }) },
    "Gemini"
  );
  const parts1 =
    (d1 as GeminiResp)?.candidates?.[0]?.content?.parts ?? [];
  const fcPart = parts1.find((p) => p.functionCall);

  if (fcPart?.functionCall) {
    const args = (fcPart.functionCall.args ?? {}) as EntradaRelatorio;
    const { resultado, arquivoUrl } = await exec(args);
    contents.push({ role: "model", parts: [{ functionCall: fcPart.functionCall }] });
    contents.push({
      role: "user",
      parts: [{ functionResponse: { name: "gerar_relatorio", response: { resultado } } }],
    });
    const d2 = await requisitar(
      url,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, contents }) },
      "Gemini"
    );
    return { resposta: textoGemini(d2), arquivoUrl };
  }

  return { resposta: textoGemini(d1) };
}

function textoGemini(d: Record<string, unknown>): string {
  return (
    (d as GeminiResp)?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join("") || "(sem resposta)"
  );
}

// ---------------- Dispatcher ----------------
export async function conversar(
  provedor: Provedor,
  cfg: {
    claudeApiKey: string | null;
    claudeModelo: string;
    geminiApiKey: string | null;
    geminiModelo: string;
    openaiApiKey: string | null;
    openaiModelo: string;
  },
  system: string,
  mensagens: Mensagem[],
  exec: ExecutorRelatorio
): Promise<RespostaIA> {
  if (provedor === "claude") {
    if (!cfg.claudeApiKey) throw new Error("Chave da Claude não configurada.");
    return chamarClaude(cfg.claudeApiKey, cfg.claudeModelo, system, mensagens, exec);
  }
  if (provedor === "gemini") {
    if (!cfg.geminiApiKey) throw new Error("Chave do Gemini não configurada.");
    return chamarGemini(cfg.geminiApiKey, cfg.geminiModelo, system, mensagens, exec);
  }
  if (provedor === "openai") {
    if (!cfg.openaiApiKey) throw new Error("Chave do ChatGPT não configurada.");
    return chamarOpenAI(cfg.openaiApiKey, cfg.openaiModelo, system, mensagens, exec);
  }
  throw new Error("Provedor inválido.");
}
