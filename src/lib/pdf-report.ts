// Builder de PDF reutilizável (pdf-lib) com cabeçalho, seções, tabelas, KPIs e paginação.
// Uso exclusivo no servidor.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const AZUL = rgb(0.145, 0.388, 0.922);
const CINZA = rgb(0.4, 0.4, 0.4);
const PRETO = rgb(0.1, 0.1, 0.1);
const CINZA_CLARO = rgb(0.94, 0.96, 1);

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 40;
const Y_MIN = 60;

// As fontes padrão (Helvetica) só codificam WinAnsi (≈ Latin-1): um emoji, "≥" ou "→" num texto
// do usuário (título de evento, descrição de recibo) faria o pdf-lib lançar e o relatório falhar.
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const TROCAS: Record<string, string> = { "≥": ">=", "≤": "<=", "→": "->", "←": "<-", "−": "-", "✓": "v" };
export function textoPdf(s: string): string {
  return s
    .replace(/[\t\n\r]+/g, " ")
    .replace(/./gu, (c) => {
      if (TROCAS[c]) return TROCAS[c];
      const n = c.codePointAt(0)!;
      if ((n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || WINANSI_EXTRA.has(c)) return c;
      return "";
    });
}

export type Doc = {
  pdf: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
  titulo: string;
  subtitulo: string;
};

export async function novoDoc(titulo: string, subtitulo: string): Promise<Doc> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const d: Doc = {
    pdf,
    font,
    bold,
    page: null as unknown as PDFPage,
    y: 0,
    titulo: textoPdf(titulo),
    subtitulo: textoPdf(subtitulo),
  };
  novaPagina(d);
  return d;
}

function novaPagina(d: Doc) {
  d.page = d.pdf.addPage([A4.largura, A4.altura]);
  d.y = A4.altura - MARGEM;
  // Cabeçalho
  d.page.drawText(d.titulo, { x: MARGEM, y: d.y, size: 18, font: d.bold, color: AZUL });
  d.y -= 18;
  d.page.drawText(d.subtitulo, { x: MARGEM, y: d.y, size: 10, font: d.font, color: CINZA });
  d.y -= 8;
  d.page.drawLine({
    start: { x: MARGEM, y: d.y },
    end: { x: A4.largura - MARGEM, y: d.y },
    thickness: 1,
    color: AZUL,
  });
  d.y -= 20;
}

function garantirEspaco(d: Doc, altura: number) {
  if (d.y - altura < Y_MIN) novaPagina(d);
}

export function secao(d: Doc, texto: string) {
  garantirEspaco(d, 64); // título + cabeçalho de tabela + 1 linha: evita título órfão no pé da página
  d.y -= 6;
  d.page.drawText(textoPdf(texto), { x: MARGEM, y: d.y, size: 13, font: d.bold, color: PRETO });
  d.y -= 18;
}

function quebrarTexto(font: PDFFont, texto: string, size: number, larguraMax: number): string[] {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (font.widthOfTextAtSize(teste, size) > larguraMax && atual) {
      linhas.push(atual);
      atual = p;
    } else {
      atual = teste;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export function paragrafo(d: Doc, texto: string, size = 10) {
  const larguraMax = A4.largura - 2 * MARGEM;
  for (const linha of quebrarTexto(d.font, textoPdf(texto), size, larguraMax)) {
    garantirEspaco(d, size + 4);
    d.page.drawText(linha, { x: MARGEM, y: d.y, size, font: d.font, color: PRETO });
    d.y -= size + 4;
  }
  d.y -= 4;
}

export function kpis(d: Doc, items: { label: string; valor: string }[]) {
  const larguraTotal = A4.largura - 2 * MARGEM;
  const porLinha = 3;
  const largura = larguraTotal / porLinha;
  for (let i = 0; i < items.length; i += porLinha) {
    const linha = items.slice(i, i + porLinha);
    garantirEspaco(d, 44);
    const yBase = d.y;
    linha.forEach((it, j) => {
      const x = MARGEM + j * largura;
      d.page.drawText(textoPdf(it.label.toUpperCase()), { x, y: yBase, size: 8, font: d.font, color: CINZA });
      d.page.drawText(textoPdf(it.valor), { x, y: yBase - 16, size: 14, font: d.bold, color: PRETO });
    });
    d.y -= 44;
  }
}

export function tabela(
  d: Doc,
  colunas: { titulo: string; largura: number; alinhar?: "esquerda" | "direita" }[],
  linhas: string[][]
) {
  const desenharCabecalho = () => {
    garantirEspaco(d, 22);
    d.page.drawRectangle({
      x: MARGEM,
      y: d.y - 4,
      width: A4.largura - 2 * MARGEM,
      height: 18,
      color: CINZA_CLARO,
    });
    let x = MARGEM + 4;
    colunas.forEach((c) => {
      d.page.drawText(textoPdf(c.titulo), { x, y: d.y, size: 9, font: d.bold, color: PRETO });
      x += c.largura;
    });
    d.y -= 22;
  };

  desenharCabecalho();

  for (const linha of linhas) {
    if (d.y - 16 < Y_MIN) {
      novaPagina(d);
      desenharCabecalho();
    }
    let x = MARGEM + 4;
    linha.forEach((bruta, i) => {
      const c = colunas[i];
      const size = 9;
      // Corta o que não cabe na coluna (texto livre do usuário não pode invadir a próxima)
      let celula = textoPdf(bruta);
      while (celula.length > 1 && d.font.widthOfTextAtSize(celula, size) > c.largura - 8) {
        celula = `${celula.slice(0, -2)}…`;
      }
      let tx = x;
      if (c.alinhar === "direita") {
        const w = d.font.widthOfTextAtSize(celula, size);
        tx = x + c.largura - w - 8;
      }
      d.page.drawText(celula, { x: tx, y: d.y, size, font: d.font, color: PRETO });
      x += c.largura;
    });
    d.y -= 16;
  }
  d.y -= 6;
}

/** Gráfico de barras simples (uma série). `fraca` = barra clara (ex.: dia com dado não confiável). */
export function graficoBarras(
  d: Doc,
  barras: { rotulo: string; valor: number; fraca?: boolean }[],
  opts: { formatarEixo: (v: number) => string; altura?: number; rotuloACada?: number }
) {
  if (barras.length === 0) return;
  const altura = opts.altura ?? 130;
  garantirEspaco(d, altura + 34);
  const x0 = MARGEM + 44; // espaço para os valores do eixo Y
  const largura = A4.largura - MARGEM - x0;
  const max = Math.max(1, ...barras.map((b) => b.valor));
  const yBase = d.y - altura;

  for (let i = 0; i <= 2; i++) {
    const y = yBase + (altura * i) / 2;
    d.page.drawLine({ start: { x: x0, y }, end: { x: x0 + largura, y }, thickness: 0.4, color: CINZA_CLARO });
    const rot = textoPdf(opts.formatarEixo((max * i) / 2));
    const w = d.font.widthOfTextAtSize(rot, 7);
    d.page.drawText(rot, { x: x0 - w - 4, y: y - 2.5, size: 7, font: d.font, color: CINZA });
  }

  const passo = largura / barras.length;
  const lb = Math.max(1, passo * 0.75);
  const cada = opts.rotuloACada ?? Math.max(1, Math.ceil(barras.length / 16));
  barras.forEach((b, i) => {
    const h = (Math.max(0, b.valor) / max) * altura;
    const x = x0 + i * passo + (passo - lb) / 2;
    if (h > 0) d.page.drawRectangle({ x, y: yBase, width: lb, height: h, color: AZUL, opacity: b.fraca ? 0.3 : 1 });
    if (i % cada === 0) {
      const rot = textoPdf(b.rotulo);
      const w = d.font.widthOfTextAtSize(rot, 6.5);
      d.page.drawText(rot, { x: x + lb / 2 - w / 2, y: yBase - 10, size: 6.5, font: d.font, color: CINZA });
    }
  });
  d.y = yBase - 24;
}

export function totalLinha(d: Doc, rotulo: string, valor: string) {
  garantirEspaco(d, 22);
  d.page.drawLine({
    start: { x: MARGEM, y: d.y + 8 },
    end: { x: A4.largura - MARGEM, y: d.y + 8 },
    thickness: 0.5,
    color: CINZA,
  });
  rotulo = textoPdf(rotulo);
  valor = textoPdf(valor);
  d.page.drawText(rotulo, { x: MARGEM, y: d.y - 6, size: 11, font: d.bold, color: PRETO });
  const w = d.bold.widthOfTextAtSize(valor, 11);
  d.page.drawText(valor, {
    x: A4.largura - MARGEM - w - 8,
    y: d.y - 6,
    size: 11,
    font: d.bold,
    color: AZUL,
  });
  d.y -= 26;
}

export async function finalizar(d: Doc): Promise<Uint8Array> {
  const paginas = d.pdf.getPages();
  const total = paginas.length;
  paginas.forEach((p, i) => {
    const txt = `Página ${i + 1} de ${total}`;
    const w = d.font.widthOfTextAtSize(txt, 8);
    p.drawText(txt, { x: A4.largura - MARGEM - w, y: 30, size: 8, font: d.font, color: CINZA });
    p.drawText("Gerado pelo Sistema de Gestão de Condomínio", {
      x: MARGEM,
      y: 30,
      size: 8,
      font: d.font,
      color: CINZA,
    });
  });
  return d.pdf.save();
}
