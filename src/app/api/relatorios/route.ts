import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ehAdmin } from "@/lib/permissoes";
import { gerarRelatorio, type TipoRelatorio } from "@/lib/relatorios";

const TIPOS_VALIDOS: TipoRelatorio[] = [
  "financeiro",
  "obras",
  "fornecedores",
  "geral",
  "manutencao",
  "auditoria",
];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const tipo = req.nextUrl.searchParams.get("tipo") as TipoRelatorio | null;
  const mes = req.nextUrl.searchParams.get("mes") ?? undefined;

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ erro: "Tipo de relatório inválido." }, { status: 400 });
  }

  // Auditoria é restrita ao síndico/admin.
  if (tipo === "auditoria" && !ehAdmin(session.user.papel)) {
    return NextResponse.json({ erro: "Acesso restrito ao síndico/admin." }, { status: 403 });
  }

  const { bytes, nomeArquivo } = await gerarRelatorio(tipo, { mesReferencia: mes });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
