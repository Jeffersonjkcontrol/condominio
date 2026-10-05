"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ehAdmin } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";
import { TIPOS_INDICADOR } from "@/lib/agua-calc";
import { liberarProcessamento } from "@/lib/agua";

async function exigirAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (!ehAdmin(session.user.papel)) throw new Error("Sem permissão.");
}

/** Campo numérico opcional: vazio → undefined; aceita vírgula decimal. */
const litrosOpcional = z.preprocess(
  (v) => (v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).replace(",", ".")),
  z.coerce.number().nonnegative("Use um valor positivo.").optional()
);

const schema = z
  .object({
    nome: z.string().trim().min(1, "Informe o nome."),
    deviceLabel: z.string().trim().min(1, "Informe o deviceLabel."),
    variableLabel: z.string().trim().min(1, "Informe o variableLabel."),
    unidade: z.string().trim().optional(),
    ordem: z.coerce.number().optional(),
    tipo: z.enum(TIPOS_INDICADOR).default("GENERICO"),
    capacidadeLitros: litrosOpcional,
    reservaLitros: litrosOpcional,
  })
  .refine((d) => d.tipo !== "NIVEL_RESERVATORIO" || (d.capacidadeLitros ?? 0) > 0, {
    message: "Informe a capacidade do reservatório (litros).",
    path: ["capacidadeLitros"],
  })
  .refine(
    (d) => d.reservaLitros == null || d.capacidadeLitros == null || d.reservaLitros <= d.capacidadeLitros,
    { message: "A reserva não pode ser maior que a capacidade.", path: ["reservaLitros"] }
  );

function ler(formData: FormData) {
  return schema.parse({
    nome: formData.get("nome"),
    deviceLabel: formData.get("deviceLabel"),
    variableLabel: formData.get("variableLabel"),
    unidade: (formData.get("unidade") as string) || undefined,
    ordem: formData.get("ordem") ?? 0,
    tipo: (formData.get("tipo") as string) || undefined,
    capacidadeLitros: formData.get("capacidadeLitros"),
    reservaLitros: formData.get("reservaLitros"),
  });
}

function revalidar(id?: string) {
  liberarProcessamento(); // processa o consumo já na próxima página aberta
  revalidatePath("/configuracoes");
  revalidatePath("/", "layout");
  if (id) revalidatePath(`/indicadores/${id}`);
}

export async function criarIndicador(formData: FormData) {
  await exigirAdmin();
  const d = ler(formData);
  await prisma.indicadorExterno.create({
    data: {
      nome: d.nome,
      deviceLabel: d.deviceLabel,
      variableLabel: d.variableLabel,
      unidade: d.unidade,
      ordem: d.ordem ?? 0,
      tipo: d.tipo,
      capacidadeLitros: d.capacidadeLitros ?? null,
      reservaLitros: d.reservaLitros ?? null,
    },
  });
  await registrar("CRIOU", "Indicador externo", `${d.nome} (${d.deviceLabel}/${d.variableLabel})`);
  revalidar();
}

export async function atualizarIndicador(formData: FormData) {
  await exigirAdmin();
  const id = String(formData.get("id"));
  const d = ler(formData);
  const antes = await prisma.indicadorExterno.findUnique({ where: { id } });
  await prisma.indicadorExterno.update({
    where: { id },
    data: {
      nome: d.nome,
      deviceLabel: d.deviceLabel,
      variableLabel: d.variableLabel,
      unidade: d.unidade,
      ordem: d.ordem ?? 0,
      ativo: formData.get("ativo") === "on",
      tipo: d.tipo,
      capacidadeLitros: d.capacidadeLitros ?? null,
      reservaLitros: d.reservaLitros ?? null,
    },
  });
  // Mudou algo que altera o cálculo do consumo → descarta o histórico; ele é refeito sozinho.
  const mudouCalculo =
    antes &&
    (antes.tipo !== d.tipo ||
      antes.deviceLabel !== d.deviceLabel ||
      antes.variableLabel !== d.variableLabel ||
      (antes.unidade ?? null) !== (d.unidade ?? null) ||
      (antes.capacidadeLitros ?? null) !== (d.capacidadeLitros ?? null));
  if (mudouCalculo) await prisma.consumoDiario.deleteMany({ where: { indicadorId: id } });
  await registrar(
    "EDITOU",
    "Indicador externo",
    `${d.nome}${mudouCalculo ? " (histórico de consumo será recalculado)" : ""}`,
    id
  );
  revalidar(id);
}

/** Descarta o histórico de consumo do indicador; o processamento em segundo plano o refaz. */
export async function recalcularConsumo(formData: FormData) {
  await exigirAdmin();
  const id = String(formData.get("id"));
  const ind = await prisma.indicadorExterno.findUnique({ where: { id } });
  if (!ind) return;
  await prisma.consumoDiario.deleteMany({ where: { indicadorId: id } });
  await registrar("EDITOU", "Indicador externo", `${ind.nome} (recalcular histórico de consumo)`, id);
  revalidar(id);
}

export async function excluirIndicador(formData: FormData) {
  await exigirAdmin();
  const id = String(formData.get("id"));
  const ind = await prisma.indicadorExterno.findUnique({ where: { id } });
  await prisma.indicadorExterno.delete({ where: { id } });
  if (ind) await registrar("EXCLUIU", "Indicador externo", ind.nome, id);
  revalidar();
}
