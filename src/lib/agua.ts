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
const INTERVALO_ATRASADO_MS = 60_000; // recuperando histórico: rodadas a cada 1 min
const INTERVALO_SEM_SENSOR_MS = 5 * 60_000; // nenhum sensor de consumo ainda: checa de novo logo
const DIAS_HISTORICO = 90; // 1ª vez: busca até 90 dias para trás
const DIAS_POR_RODADA = 15; // dias COM leitura por rodada (limita o trabalho)
const DIAS_MAX_POR_RODADA = 100; // teto incluindo dias vazios (antes do sensor existir são baratos)
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

      while (dia <= ontem) {
        if (processados >= DIAS_POR_RODADA || vistos >= DIAS_MAX_POR_RODADA) {
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
    if (atrasado) proximaExecucao = agora + INTERVALO_ATRASADO_MS;
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
  const { ok, leituras } = await leiturasDoDia(ind, diaBR(Date.now()), 60);
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
};

/** Consumo diário guardado dos últimos `dias` dias (mais antigo → mais recente). */
export async function historicoConsumo(indicadorId: string, dias = 30): Promise<DiaConsumo[]> {
  const desde = somarDias(diaBR(Date.now()), -dias);
  const linhas = await prisma.consumoDiario.findMany({
    where: { indicadorId, dia: { gte: desde } },
    orderBy: { dia: "asc" },
  });
  return linhas.map((l) => {
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
    };
  });
}
