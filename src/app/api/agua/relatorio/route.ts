import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { montarRelatorioAgua, gerarPdfAgua, gerarXlsxAgua, nomeArquivoAgua } from "@/lib/relatorio-agua";

// Relatório de consumo de água em PDF ou Excel.
// ?sensor=<id>&periodo=30d|90d|mes|mes-anterior|personalizado&de=&ate=&mes=AAAA-MM&formato=pdf|xlsx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  const p = req.nextUrl.searchParams;
  const rel = await montarRelatorioAgua({
    sensorId: p.get("sensor"),
    periodo: p.get("periodo"),
    de: p.get("de"),
    ate: p.get("ate"),
    mes: p.get("mes"),
  });
  if (!rel) {
    return NextResponse.json({ erro: "Nenhum sensor de consumo de água cadastrado." }, { status: 404 });
  }

  if (p.get("formato") === "xlsx") {
    return new NextResponse(new Uint8Array(await gerarXlsxAgua(rel)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomeArquivoAgua(rel, "xlsx")}"`,
      },
    });
  }
  return new NextResponse(Buffer.from(await gerarPdfAgua(rel)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivoAgua(rel, "pdf")}"`,
    },
  });
}
