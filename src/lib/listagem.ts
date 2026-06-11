// Helpers de listagem: paginação e construção de query strings preservando filtros.

export const POR_PAGINA = 25;

export type SP = Record<string, string | string[] | undefined>;

/** Lê um parâmetro como string (pega o 1º se vier array). */
export function par(sp: SP, chave: string): string | undefined {
  const v = sp[chave];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length ? s : undefined;
}

/** Página atual + skip/take para o Prisma. */
export function lerPagina(sp: SP): { pagina: number; skip: number; take: number } {
  const pagina = Math.max(1, parseInt(par(sp, "pagina") ?? "1", 10) || 1);
  return { pagina, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA };
}

/** Monta "?a=1&b=2" a partir dos params atuais + alterações (override). Valor "" remove. */
export function construirQuery(
  sp: SP,
  overrides: Record<string, string | number | undefined> = {}
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) params.set(k, s);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
