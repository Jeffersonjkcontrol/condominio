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
  const d: Doc = { pdf, font, bold, page: null as unknown as PDFPage, y: 0, titulo, subtitulo };
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
  garantirEspaco(d, 30);
  d.y -= 6;
  d.page.drawText(texto, { x: MARGEM, y: d.y, size: 13, font: d.bold, color: PRETO });
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
  for (const linha of quebrarTexto(d.font, texto, size, larguraMax)) {
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
      d.page.drawText(it.label.toUpperCase(), { x, y: yBase, size: 8, font: d.font, color: CINZA });
      d.page.drawText(it.valor, { x, y: yBase - 16, size: 14, font: d.bold, color: PRETO });
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
      d.page.drawText(c.titulo, { x, y: d.y, size: 9, font: d.bold, color: PRETO });
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
    linha.forEach((celula, i) => {
      const c = colunas[i];
      const size = 9;
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

export function totalLinha(d: Doc, rotulo: string, valor: string) {
  garantirEspaco(d, 22);
  d.page.drawLine({
    start: { x: MARGEM, y: d.y + 8 },
    end: { x: A4.largura - MARGEM, y: d.y + 8 },
    thickness: 0.5,
    color: CINZA,
  });
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
