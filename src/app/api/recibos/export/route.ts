import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatarData, formatarMoeda } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  const formato = req.nextUrl.searchParams.get("formato") ?? "xlsx";

  const recibos = await prisma.recibo.findMany({
    orderBy: { dataEmissao: "desc" },
    include: { fornecedor: { select: { nome: true } } },
  });

  const total = recibos.reduce((s, r) => s + r.valor, 0);

  if (formato === "pdf") {
    const pdf = await PDFDocument.create();
    const fonte = await pdf.embedFont(StandardFonts.Helvetica);
    const fonteBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595, 842]); // A4
    const margem = 40;
    let y = 800;

    page.drawText("Relatório de Recibos", {
      x: margem,
      y,
      size: 18,
      font: fonteBold,
      color: rgb(0.15, 0.39, 0.92),
    });
    y -= 24;
    page.drawText(`Gerado em ${formatarData(new Date())}`, {
      x: margem,
      y,
      size: 9,
      font: fonte,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 24;

    const cols = [
      { t: "Data", x: margem },
      { t: "Categoria", x: margem + 70 },
      { t: "Fornecedor", x: margem + 170 },
      { t: "Status", x: margem + 360 },
      { t: "Valor", x: margem + 450 },
    ];
    const header = () => {
      page.drawRectangle({
        x: margem - 4,
        y: y - 4,
        width: 515,
        height: 18,
        color: rgb(0.94, 0.96, 1),
      });
      cols.forEach((c) =>
        page.drawText(c.t, { x: c.x, y, size: 9, font: fonteBold })
      );
      y -= 22;
    };
    header();

    for (const r of recibos) {
      if (y < 60) {
        page = pdf.addPage([595, 842]);
        y = 800;
        header();
      }
      page.drawText(formatarData(r.dataEmissao), { x: cols[0].x, y, size: 8, font: fonte });
      page.drawText(r.categoria.slice(0, 16), { x: cols[1].x, y, size: 8, font: fonte });
      page.drawText((r.fornecedor?.nome ?? "—").slice(0, 30), {
        x: cols[2].x,
        y,
        size: 8,
        font: fonte,
      });
      page.drawText(r.status, { x: cols[3].x, y, size: 8, font: fonte });
      page.drawText(formatarMoeda(r.valor), { x: cols[4].x, y, size: 8, font: fonte });
      y -= 16;
    }

    y -= 8;
    page.drawText(`Total: ${formatarMoeda(total)}`, {
      x: cols[3].x,
      y,
      size: 11,
      font: fonteBold,
    });

    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="recibos.pdf"`,
      },
    });
  }

  // XLSX
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Recibos");
  ws.columns = [
    { header: "Data", key: "data", width: 14 },
    { header: "Categoria", key: "categoria", width: 20 },
    { header: "Fornecedor", key: "fornecedor", width: 30 },
    { header: "Descrição", key: "descricao", width: 40 },
    { header: "Status", key: "status", width: 14 },
    { header: "Valor (R$)", key: "valor", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF6FF" },
  };

  recibos.forEach((r) => {
    ws.addRow({
      data: formatarData(r.dataEmissao),
      categoria: r.categoria,
      fornecedor: r.fornecedor?.nome ?? "—",
      descricao: r.descricao ?? "",
      status: r.status,
      valor: r.valor,
    });
  });
  ws.addRow({});
  const totalRow = ws.addRow({ status: "TOTAL", valor: total });
  totalRow.font = { bold: true };
  ws.getColumn("valor").numFmt = '"R$" #,##0.00';

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="recibos.xlsx"`,
    },
  });
}
