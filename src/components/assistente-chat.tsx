"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Sparkles, User, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Provedor = "claude" | "gemini" | "openai";
type Mensagem = { role: "user" | "assistant"; content: string; arquivoUrl?: string };

const LABEL: Record<Provedor, string> = {
  claude: "Claude",
  gemini: "Gemini",
  openai: "ChatGPT",
};

const SUGESTOES = [
  "Quanto gastei neste mês?",
  "Quais obras estão atrasadas e por quantos dias?",
  "Resuma os gastos por categoria.",
  "O que devo priorizar nesta semana?",
];

export function AssistenteChat({
  disponiveis,
  conversaIdInicial = null,
  mensagensIniciais = [],
}: {
  disponiveis: { provedor: Provedor; label: string }[];
  conversaIdInicial?: string | null;
  mensagensIniciais?: Mensagem[];
}) {
  const router = useRouter();
  const [provedor, setProvedor] = useState<Provedor>(disponiveis[0]?.provedor ?? "claude");
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais);
  const [conversaId, setConversaId] = useState<string | null>(conversaIdInicial);
  const [entrada, setEntrada] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  async function enviar(texto: string) {
    const conteudo = texto.trim();
    if (!conteudo || carregando) return;
    setErro("");
    const novas: Mensagem[] = [...mensagens, { role: "user", content: conteudo }];
    setMensagens(novas);
    setEntrada("");
    setCarregando(true);
    try {
      const resp = await fetch("/api/assistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provedor, mensagens: novas, conversaId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.erro ?? "Falha na consulta.");
      setMensagens((m) => [
        ...m,
        { role: "assistant", content: data.resposta, arquivoUrl: data.arquivoUrl },
      ]);
      if (data.conversaId && !conversaId) {
        setConversaId(data.conversaId);
        router.refresh(); // atualiza a lista de conversas no histórico
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setCarregando(false);
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-xl border border-border bg-surface">
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Sparkles className="h-4 w-4 text-primary" />
          Conversando com
        </div>
        <div className="w-48">
          <Select value={provedor} onChange={(e) => setProvedor(e.target.value as Provedor)}>
            {disponiveis.map((d) => (
              <option key={d.provedor} value={d.provedor}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {mensagens.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="font-medium text-foreground">
              Olá! Sou seu assistente de gestão.
            </p>
            <p className="mb-4 text-sm text-muted">
              Pergunte sobre gastos, obras, atrasos e prazos do condomínio.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m, i) => (
          <div
            key={i}
            className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "")}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/15 text-primary"
              )}
            >
              {m.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <div
              className={cn(
                "max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-muted text-foreground"
              )}
            >
              {m.content}
              {m.arquivoUrl && (
                <a
                  href={m.arquivoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  <FileDown className="h-3.5 w-3.5" /> Baixar relatório PDF
                </a>
              )}
            </div>
          </div>
        ))}

        {carregando && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> {LABEL[provedor]} está pensando…
          </div>
        )}
        {erro && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>
        )}
        <div ref={fimRef} />
      </div>

      {/* Entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(entrada);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Digite sua pergunta…"
          className="h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" className="h-11 w-11" disabled={carregando}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
