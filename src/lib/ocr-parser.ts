/** Utilitários para extrair campos de um texto de recibo (resultado do OCR). Client-safe. */

/** Procura o maior valor monetário no formato brasileiro (R$ 1.234,56). */
export function extrairValor(texto: string): number | null {
  const regex = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi;
  const valores: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    const num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    if (!Number.isNaN(num)) valores.push(num);
  }
  if (valores.length === 0) return null;
  // Heurística: o maior valor costuma ser o total.
  return Math.max(...valores);
}

/** Procura uma data dd/mm/aaaa (ou dd/mm/aa) e retorna no formato yyyy-mm-dd. */
export function extrairData(texto: string): string | null {
  const regex = /(\d{2})[/.-](\d{2})[/.-](\d{2,4})/;
  const m = regex.exec(texto);
  if (!m) return null;
  let [, dia, mes, ano] = m;
  if (ano.length === 2) ano = `20${ano}`;
  const d = Number(dia),
    mo = Number(mes);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return `${ano}-${mes}-${dia}`;
}

/** Tenta achar uma linha que pareça o nome do fornecedor (primeira linha não vazia relevante). */
export function extrairFornecedor(texto: string): string | null {
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
  return linhas[0] ?? null;
}

/** Sugere uma categoria a partir de palavras-chave no texto do recibo. */
export function sugerirCategoria(texto: string): string | null {
  const t = texto.toLowerCase();
  const regras: [RegExp, string][] = [
    [/[áa]gua|energia|\bluz\b|enel|sabesp|cpfl|\blight\b|cemig|copel|\bkwh\b|il[uú]m\.?\s*p[uú]blica|distribuidora de energia|segunda via|conta de luz|\bm3\b|hidr[ôo]metro|consumo de [áa]gua/, "Água/Energia"],
    [/limpez|faxin|higien|zelador/, "Limpeza"],
    [/seguran|vigil|portari|c[âa]mera|monitora/, "Segurança"],
    [/obra|reforma|constru|pedreir|alvenar|pintur/, "Obra"],
    [/manuten|reparo|conserto|bomba|eleva|encanad|el[ée]tric/, "Manutenção"],
    [/material|materiais|ferragem|tinta|cimento|areia/, "Material"],
    [/administ|cart[óo]rio|contab|honor[áa]rio|advog/, "Administrativo"],
  ];
  for (const [re, cat] of regras) if (re.test(t)) return cat;
  return null;
}

/** Casa o nome detectado (ou o texto todo) com um fornecedor já cadastrado. */
export function casarFornecedor(
  texto: string,
  fornecedores: { id: string; nome: string }[]
): string | null {
  const t = texto.toLowerCase();
  for (const f of fornecedores) {
    const nome = f.nome.toLowerCase().trim();
    if (nome.length >= 3 && t.includes(nome)) return f.id;
  }
  return null;
}
