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
    conexaoId: z.string().trim().optional(), // vazio = chave principal
    // Ignora leituras anteriores no consumo (ex.: sensor trocado). Vazio = sem corte.
    leiturasDesde: z.preprocess(
      (v) => (v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim()),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
        .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Data inválida.")
        .optional()
    ),
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
    conexaoId: (formData.get("conexaoId") as string) || undefined,
    leiturasDesde: formData.get("leiturasDesde"),
  });
}

/** Confere que a chave adicional escolhida existe; vazio = principal (null). */
async function conexaoValida(conexaoId: string | undefined): Promise<string | null> {
  if (!conexaoId) return null;
  const existe = await prisma.conexaoNexus.findUnique({ where: { id: conexaoId }, select: { id: true } });
  if (!existe) throw new Error("Chave de API não encontrada.");
  return conexaoId;
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
  const conexaoId = await conexaoValida(d.conexaoId);
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
      leiturasDesde: d.leiturasDesde ?? null,
      conexaoId,
    },
  });
  await registrar("CRIOU", "Indicador externo", `${d.nome} (${d.deviceLabel}/${d.variableLabel})`);
  revalidar();
}

export async function atualizarIndicador(formData: FormData) {
  await exigirAdmin();
  const id = String(formData.get("id"));
  const d = ler(formData);
  const conexaoId = await conexaoValida(d.conexaoId);
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
      leiturasDesde: d.leiturasDesde ?? null,
      conexaoId,
    },
  });
  // Mudou algo que altera o cálculo do consumo → descarta o histórico; ele é refeito sozinho.
  // (Outra chave = outra organização = outra série de dados.)
  const mudouCalculo =
    antes &&
    (antes.tipo !== d.tipo ||
      (antes.conexaoId ?? null) !== conexaoId ||
      (antes.leiturasDesde ?? null) !== (d.leiturasDesde ?? null) ||
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

// ── Chaves de API adicionais (sensores de outras organizações da jkcontrol.online) ──
// A chave nunca é devolvida para a tela nem registrada na auditoria.

const ENTIDADE_CHAVE = "Chave de API (jkcontrol.online)";
const nomeChave = z.string().trim().min(1, "Informe um nome para a chave.").max(60, "Nome muito longo.");
const valorChave = z
  .string()
  .trim()
  .min(8, "Chave muito curta.")
  .max(500, "Chave muito longa.")
  .regex(/^\S+$/, "A chave não pode ter espaços.");

export async function criarConexaoNexus(formData: FormData) {
  await exigirAdmin();
  const nome = nomeChave.parse(formData.get("nome"));
  const apiKey = valorChave.parse(formData.get("apiKey"));
  const c = await prisma.conexaoNexus.create({ data: { nome, apiKey } });
  await registrar("CRIOU", ENTIDADE_CHAVE, nome, c.id);
  revalidar();
}

/** Renomeia e/ou troca a chave (campo da chave em branco = mantém a atual). */
export async function atualizarConexaoNexus(formData: FormData) {
  await exigirAdmin();
  const id = String(formData.get("id"));
  const nome = nomeChave.parse(formData.get("nome"));
  const novaChave = String(formData.get("apiKey") ?? "").trim();
  const apiKey = novaChave ? valorChave.parse(novaChave) : undefined;
  await prisma.conexaoNexus.update({ where: { id }, data: { nome, ...(apiKey ? { apiKey } : {}) } });
  await registrar("EDITOU", ENTIDADE_CHAVE, `${nome}${apiKey ? " (chave substituída)" : ""}`, id);
  revalidar();
}

export async function excluirConexaoNexus(formData: FormData) {
  await exigirAdmin();
  const id = String(formData.get("id"));
  const emUso = await prisma.indicadorExterno.count({ where: { conexaoId: id } });
  if (emUso > 0) {
    throw new Error(`Esta chave é usada por ${emUso} sensor(es). Troque a chave deles ou exclua-os antes.`);
  }
  const c = await prisma.conexaoNexus.delete({ where: { id } });
  await registrar("EXCLUIU", ENTIDADE_CHAVE, c.nome, id);
  revalidar();
}
