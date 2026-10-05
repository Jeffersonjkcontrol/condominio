import "server-only";
import { prisma } from "@/lib/prisma";
import { buscarLeituras } from "@/lib/nexus";
import {
  agregarDia,
  calculaConsumo,
  diaBR,
  inicioDiaBR,
  paraLitros,
  somarDias,
  type Leitura,
  type ResultadoDia,
} from "@/lib/agua-calc";

// Contabilidade do consumo de água (nível de reservatório / hidrômetro), a partir da
// plataforma jkcontrol.online. Estratégia "preguiçosa", igual às contas fixas: roda depois
// de servir uma página (after() no layout), com intervalo mínimo, e recupera os dias que
// faltam — sem cron e sem servidor rodando 24h.

const INTERVALO_MS = 30 * 60_000; // em dia: no máximo 1 rodada a cada 30 min
const INTERVALO_ATRASADO_MS = 10_000; // recuperando histórico: a próxima página já continua
const INTERVALO_SEM_SENSOR_MS = 5 * 60_000; // nenhum sensor de consumo ainda: checa de novo logo
const DIAS_HISTORICO = 90; // 1ª vez: busca até 90 dias para trás
// Orçamento por rodada: roda depois da resposta (after()), então não deixa a página lenta.
// ~0,15 s por dia → os 90 dias iniciais cabem numa rodada só.
const TEMPO_MAX_RODADA_MS = 20_000;
const DIAS_MAX_POR_RODADA = 200; // teto de segurança (somando todos os sensores)
const DIA_MS = 86_400_000;

let proximaExecucao = 0;
let rodando = false;

type IndicadorConsumo = {
  id: string;
  deviceLabel: string;
  variableLabel: string;
  unidade: string | null;
  tipo: string;
  capacidadeLitros: number | null;
  conexaoId: string | null;
  leiturasDesde: string | null;
};

/** Leituras de um dia de Brasília, já em litros. `ok: false` = não dá para confiar (não gravar). */
async function leiturasDoDia(
  ind: IndicadorConsumo,
  dia: string,
  cacheSegundos?: number
): Promise<{ ok: boolean; leituras: Leitura[] }> {
  const ini = inicioDiaBR(dia);
  const r = await buscarLeituras(ind, ini, ini + DIA_MS, {
    maxPaginas: 30, // 30 mil leituras: cobre até 1 leitura a cada 3 s
    cacheSegundos,
  });
  return {
    ok: r.ok && r.completo,
    leituras: r.leituras.map((l) => ({
      t: l.t,
      v: paraLitros(l.v, ind.unidade, ind.capacidadeLitros),
    })),
  };
}

function dadosDoDia(r: ResultadoDia) {
  const um = (x: number) => Math.round(x * 10) / 10;
  return {
    consumoLitros: um(r.consumoLitros),
    consumoEstimadoLitros: um(r.consumoEstimadoLitros),
    reabastecidoLitros: um(r.reabastecidoLitros),
    porHora: JSON.stringify(r.porHora.map(um)),
    horaPico: r.horaPico,
    nivelMinimo: r.nivelMinimo == null ? null : um(r.nivelMinimo),
    nivelMaximo: r.nivelMaximo == null ? null : um(r.nivelMaximo),
    amostras: r.amostras,
    cobertura: r.cobertura,
    problema: r.problema,
  };
}

/**
 * Calcula e grava o consumo dos dias completos (até ontem) que ainda faltam.
 * Nunca lança. Se a plataforma falhar para um sensor (fora do ar, chave revogada), pula esse
 * sensor e tenta de novo na próxima rodada — sem gravar zero falso e sem travar os outros.
 */
export async function processarConsumo(forcar = false): Promise<{ processados: number }> {
  const agora = Date.now();
  if (rodando || (!forcar && agora < proximaExecucao)) return { processados: 0 };
  rodando = true;
  proximaExecucao = agora + INTERVALO_MS;
  let processados = 0; // dias com leitura
  let vistos = 0; // todos os dias, inclusive vazios
  let atrasado = false;
  try {
    const indicadores = (await prisma.indicadorExterno.findMany({ where: { ativo: true } })).filter(
      (i) => calculaConsumo(i.tipo)
    );
    if (indicadores.length === 0) {
      proximaExecucao = agora + INTERVALO_SEM_SENSOR_MS;
      return { processados };
    }
    const ontem = somarDias(diaBR(agora), -1);

    for (const ind of indicadores) {
      const ultimo = await prisma.consumoDiario.findFirst({
        where: { indicadorId: ind.id },
        orderBy: { dia: "desc" },
        select: { dia: true },
      });
      let dia = ultimo ? somarDias(ultimo.dia, 1) : somarDias(ontem, -(DIAS_HISTORICO - 1));
      if (ind.leiturasDesde && dia < ind.leiturasDesde) dia = ind.leiturasDesde; // ex.: sensor trocado

      while (dia <= ontem) {
        if (Date.now() - agora > TEMPO_MAX_RODADA_MS || vistos >= DIAS_MAX_POR_RODADA) {
          atrasado = true;
          break;
        }
        const { ok, leituras } = await leiturasDoDia(ind, dia);
        if (!ok) break; // plataforma fora/chave inválida/série truncada: tenta depois
        const r = agregarDia(leituras, ind.tipo, { capacidadeLitros: ind.capacidadeLitros });
        const dados = dadosDoDia(r);
        await prisma.consumoDiario.upsert({
          where: { indicadorId_dia: { indicadorId: ind.id, dia } },
          create: { indicadorId: ind.id, dia, ...dados },
          update: { ...dados, calculadoEm: new Date() },
        });
        vistos++;
        if (r.amostras > 0) processados++;
        dia = somarDias(dia, 1);
      }
    }
  } catch (e) {
    console.error("processarConsumo:", e);
  } finally {
    if (atrasado) proximaExecucao = Date.now() + INTERVALO_ATRASADO_MS; // conta do FIM da rodada
    rodando = false;
  }
  return { processados };
}

/** Libera a próxima rodada imediatamente (ex.: logo após cadastrar ou alterar um sensor). */
export function liberarProcessamento() {
  proximaExecucao = 0;
}

/** Consumo de hoje até agora (calculado ao vivo, cache de 60s). null = plataforma indisponível. */
export async function consumoDeHoje(ind: IndicadorConsumo): Promise<ResultadoDia | null> {
  if (!calculaConsumo(ind.tipo)) return null;
  const hoje = diaBR(Date.now());
  if (ind.leiturasDesde && hoje < ind.leiturasDesde) return null;
  const { ok, leituras } = await leiturasDoDia(ind, hoje, 60);
  if (!ok) return null;
  return agregarDia(leituras, ind.tipo, { capacidadeLitros: ind.capacidadeLitros });
}

export type DiaConsumo = {
  dia: string;
  consumoLitros: number;
  consumoEstimadoLitros: number;
  reabastecidoLitros: number;
  porHora: number[];
  horaPico: number | null;
  cobertura: number;
  amostras: number;
  problema: string | null;
};

/** O histórico já foi processado até ontem? (com data inicial recente pode haver menos de 30 dias e estar em dia) */
export async function historicoEmDia(indicadorId: string): Promise<boolean> {
  const ultimo = await prisma.consumoDiario.findFirst({
    where: { indicadorId },
    orderBy: { dia: "desc" },
    select: { dia: true },
  });
  return !!ultimo && ultimo.dia >= somarDias(diaBR(Date.now()), -1);
}

type LinhaConsumo = Awaited<ReturnType<typeof prisma.consumoDiario.findMany>>[number];

function paraDiaConsumo(l: LinhaConsumo): DiaConsumo {
  let porHora: number[] = [];
  try {
    porHora = JSON.parse(l.porHora);
  } catch {
    /* linha corrompida: segue sem o detalhe por hora */
  }
  return {
    dia: l.dia,
    consumoLitros: l.consumoLitros,
    consumoEstimadoLitros: l.consumoEstimadoLitros,
    reabastecidoLitros: l.reabastecidoLitros,
    porHora,
    horaPico: l.horaPico,
    cobertura: l.cobertura,
    amostras: l.amostras,
    problema: l.problema,
  };
}

/** Consumo diário guardado dos últimos `dias` dias (mais antigo → mais recente). */
export async function historicoConsumo(indicadorId: string, dias = 30): Promise<DiaConsumo[]> {
  const desde = somarDias(diaBR(Date.now()), -dias);
  const linhas = await prisma.consumoDiario.findMany({
    where: { indicadorId, dia: { gte: desde } },
    orderBy: { dia: "asc" },
  });
  return linhas.map(paraDiaConsumo);
}

/** Consumo diário guardado de `de` a `ate` (inclusive, "AAAA-MM-DD"), mais antigo → mais recente. */
export async function consumoPeriodo(indicadorId: string, de: string, ate: string): Promise<DiaConsumo[]> {
  const linhas = await prisma.consumoDiario.findMany({
    where: { indicadorId, dia: { gte: de, lte: ate } },
    orderBy: { dia: "asc" },
  });
  return linhas.map(paraDiaConsumo);
}

/** Sensores ativos que têm consumo calculado (reservatório / hidrômetro), na ordem do Dashboard. */
export async function sensoresDeConsumo() {
  const todos = await prisma.indicadorExterno.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" },
    select: { id: true, nome: true, tipo: true, capacidadeLitros: true, leiturasDesde: true, unidade: true },
  });
  return todos.filter((i) => calculaConsumo(i.tipo));
}

/**
 * Eventos (não cancelados) por dia, para explicar picos de consumo no relatório.
 * O dia é o do fuso DO SERVIDOR — o mesmo em que a agenda grava e exibe os eventos
 * (ver nota de fuso no projeto); assim bate com o que o usuário vê em /eventos.
 */
export async function eventosPorDia(de: string, ate: string): Promise<Map<string, string[]>> {
  const ini = new Date(`${somarDias(de, -1)}T00:00:00Z`); // folga de 1 dia para os dois fusos
  const fim = new Date(`${somarDias(ate, 2)}T00:00:00Z`);
  const eventos = await prisma.evento.findMany({
    where: { status: { not: "CANCELADO" }, dataInicio: { lt: fim }, dataFim: { gte: ini } },
    orderBy: { dataInicio: "asc" },
    select: { titulo: true, dataInicio: true, dataFim: true },
  });
  const diaLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const mapa = new Map<string, string[]>();
  for (const e of eventos) {
    const primeiro = diaLocal(e.dataInicio);
    const ultimo = diaLocal(e.dataFim) >= primeiro ? diaLocal(e.dataFim) : primeiro;
    for (let d = primeiro, n = 0; d <= ultimo && n < 31; d = somarDias(d, 1), n++) {
      if (d < de || d > ate) continue;
      mapa.set(d, [...(mapa.get(d) ?? []), e.titulo]);
    }
  }
  return mapa;
}
