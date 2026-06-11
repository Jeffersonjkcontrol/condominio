import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { construirQuery, POR_PAGINA, type SP } from "@/lib/listagem";
import { cn } from "@/lib/utils";

export function Paginacao({
  basePath,
  sp,
  pagina,
  total,
}: {
  basePath: string;
  sp: SP;
  pagina: number;
  total: number;
}) {
  if (total === 0) return null;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const ini = (pagina - 1) * POR_PAGINA + 1;
  const fim = Math.min(pagina * POR_PAGINA, total);

  const temAnterior = pagina > 1;
  const temProxima = pagina < totalPaginas;

  const link =
    "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-muted";
  const desativado = "pointer-events-none opacity-40";

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <span className="text-sm text-muted">
        {ini}–{fim} de {total}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={`${basePath}${construirQuery(sp, { pagina: pagina - 1 })}`}
          className={cn(link, !temAnterior && desativado)}
          aria-disabled={!temAnterior}
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Link>
        <span className="text-sm text-muted">
          Página {pagina} de {totalPaginas}
        </span>
        <Link
          href={`${basePath}${construirQuery(sp, { pagina: pagina + 1 })}`}
          className={cn(link, !temProxima && desativado)}
          aria-disabled={!temProxima}
        >
          Próxima <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
