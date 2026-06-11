"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  Building2,
  Wrench,
  HardHat,
  Users,
  Sparkles,
  Settings,
  FileBarChart,
  Hammer,
  History,
  Repeat,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Papel } from "@prisma/client";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  somenteAdmin?: boolean;
};

const itens: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/recibos", label: "Recibos", icon: ReceiptText },
  { href: "/recorrencias", label: "Contas fixas", icon: Repeat },
  { href: "/fornecedores", label: "Fornecedores", icon: Building2 },
  { href: "/servicos", label: "Serviços", icon: Wrench },
  { href: "/obras", label: "Obras", icon: HardHat },
  { href: "/manutencao", label: "Manutenção", icon: Hammer },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart },
  { href: "/assistente", label: "Assistente IA", icon: Sparkles },
  { href: "/usuarios", label: "Usuários", icon: Users, somenteAdmin: true },
  { href: "/auditoria", label: "Auditoria", icon: History, somenteAdmin: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings, somenteAdmin: true },
];

export type Alertas = { recibos: number; obras: number; manutencao: number };

export function Sidebar({
  papel,
  alertas,
  podeIA = false,
}: {
  papel: Papel;
  alertas?: Alertas;
  podeIA?: boolean;
}) {
  const pathname = usePathname();

  const contador = (href: string): number => {
    if (href === "/recibos") return alertas?.recibos ?? 0;
    if (href === "/obras") return alertas?.obras ?? 0;
    if (href === "/manutencao") return alertas?.manutencao ?? 0;
    return 0;
  };

  return (
    <nav className="flex flex-col gap-1 p-3">
      {itens
        .filter((i) => {
          if (i.href === "/assistente") return podeIA;
          if (i.somenteAdmin) return papel === "ADMIN";
          return true;
        })
        .map((item) => {
          const ativo =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const n = contador(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                ativo
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {n > 0 && (
                <span
                  className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                    ativo ? "bg-white/25 text-white" : "bg-danger text-white"
                  )}
                  title={`${n} item(ns) precisando de atenção`}
                >
                  {n}
                </span>
              )}
            </Link>
          );
        })}
    </nav>
  );
}
