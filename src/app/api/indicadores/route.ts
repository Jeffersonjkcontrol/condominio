import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buscarIndicadores } from "@/lib/nexus";

// Proxy autenticado: o cliente lê os valores por aqui, sem nunca ver a API Key (que fica no servidor).
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  const indicadores = await buscarIndicadores();
  return NextResponse.json(indicadores);
}
