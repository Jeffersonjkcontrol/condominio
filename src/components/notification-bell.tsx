"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bell,
  AlertTriangle,
  HardHat,
  Wallet,
  ReceiptText,
  CalendarDays,
  CheckCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { marcarLida, marcarTodasLidas } from "@/app/actions/notificacoes";

type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  criadoEm: string;
};

const ICONE: Record<string, LucideIcon> = {
  OS_ATRASADA: AlertTriangle,
  OBRA_ATRASADA: HardHat,
  ORCAMENTO_ESTOURADO: Wallet,
  CONTA_FIXA_PENDENTE: ReceiptText,
  EVENTO_PROXIMO: CalendarDays,
};

export function NotificationBell({ notificacoes }: { notificacoes: Notificacao[] }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  useEffect(() => {
    if (!aberto) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [aberto]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface hover:bg-surface-muted"
        title="Notificações"
      >
        <Bell className="h-4 w-4" />
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-foreground">Notificações</span>
            {naoLidas > 0 && (
              <form action={marcarTodasLidas}>
                <button
                  type="submit"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
                </button>
              </form>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notificacoes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                Nenhuma notificação. Tudo em dia! ✅
              </p>
            ) : (
              notificacoes.map((n) => {
                const Icon = ICONE[n.tipo] ?? Bell;
                const conteudo = (
                  <div
                    className={cn(
                      "flex gap-3 px-4 py-3 hover:bg-surface-muted",
                      !n.lida && "bg-primary/5"
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        n.lida ? "text-muted" : "text-danger"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{n.titulo}</p>
                      <p className="text-xs text-muted">{n.mensagem}</p>
                    </div>
                    {!n.lida && (
                      <span className="ml-auto mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                );
                return (
                  <form
                    key={n.id}
                    action={marcarLida}
                    onSubmit={() => setTimeout(() => setAberto(false), 50)}
                  >
                    <input type="hidden" name="id" value={n.id} />
                    {n.link && <input type="hidden" name="link" value={n.link} />}
                    <button type="submit" className="block w-full text-left">
                      {conteudo}
                    </button>
                  </form>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
