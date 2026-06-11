"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Barra de busca + filtros. Envia tudo para a URL (GET) e reseta a página para 1.
 * Os filtros (selects/inputs) entram como children com `name` e `defaultValue`.
 */
export function Filtros({
  buscaDefault = "",
  placeholder = "Buscar…",
  children,
}: {
  buscaDefault?: string;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function submeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      const s = String(v).trim();
      if (s) params.set(k, s);
    }
    params.delete("pagina");
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <form onSubmit={submeter} className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          name="busca"
          defaultValue={buscaDefault}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {children}
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
      <Button type="button" variant="ghost" onClick={() => router.push(pathname)}>
        Limpar
      </Button>
    </form>
  );
}
