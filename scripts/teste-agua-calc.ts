// Testes do cálculo de consumo de água (src/lib/agua-calc.ts — funções puras).
// Rodar: npx tsx scripts/teste-agua-calc.ts
//
// Um simulador gera um dia de reservatório com consumo CONHECIDO (perfil por hora), bomba
// que liga/desliga por nível, ruído de sensor, leituras espúrias e falhas de conexão — assim
// dá para medir o erro do algoritmo contra a verdade.
import assert from "node:assert/strict";
import {
  agregarDia,
  diaBR,
  horaBR,
  inicioDiaBR,
  somarDias,
  paraLitros,
  formatarVolume,
  filtroMediana,
  type Leitura,
} from "../src/lib/agua-calc";

let falhas = 0;
function teste(nome: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${nome}`);
  } catch (e) {
    falhas++;
    console.log(`✗ ${nome}\n    ${(e as Error).message}`);
  }
}
function perto(real: number, esperado: number, tolPct: number, msg: string) {
  const ok = Math.abs(real - esperado) <= Math.abs(esperado) * tolPct;
  assert.ok(
    ok,
    `${msg}: obtido ${real.toFixed(0)}, esperado ${esperado.toFixed(0)} (tolerância ±${tolPct * 100}%)`
  );
}

// RNG determinístico (mulberry32) — testes reproduzíveis.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

// Perfil típico de condomínio: L/min em cada hora do dia (picos às 7-8h e 18-20h). Total 45.360 L.
const PERFIL = [8, 6, 5, 5, 6, 12, 35, 60, 55, 40, 32, 30, 38, 34, 28, 26, 30, 42, 62, 70, 58, 40, 22, 12];
const DIA = "2026-10-01";

type Sim = {
  capacidade: number;
  inicial: number;
  bomba?: { vazao: number; liga: number; desliga: number };
  ruido?: number; // desvio-padrão (L)
  picos?: number; // probabilidade de leitura espúria
  lacunaHoras?: [number, number]; // horas sem leitura (sensor offline)
  intervaloMin?: number;
  seed?: number;
};

function simularDia(s: Sim) {
  const r = rng(s.seed ?? 42);
  const ini = inicioDiaBR(DIA);
  const leituras: Leitura[] = [];
  let nivel = s.inicial;
  let bombaLigada = false;
  let verdade = 0;
  let mascarado = 0; // consumo que aconteceu com a bomba ligada (invisível no nível)
  const passo = s.intervaloMin ?? 1;
  for (let m = 0; m < 1440; m++) {
    const h = Math.floor(m / 60);
    const saida = PERFIL[h];
    if (s.bomba) {
      if (nivel < s.bomba.liga * s.capacidade) bombaLigada = true;
      if (nivel > s.bomba.desliga * s.capacidade) bombaLigada = false;
    }
    const entrada = s.bomba && bombaLigada ? s.bomba.vazao : 0;
    nivel = Math.min(s.capacidade, Math.max(0, nivel + entrada - saida));
    verdade += saida;
    if (bombaLigada) mascarado += saida;
    if (m % passo !== 0) continue;
    if (s.lacunaHoras && h >= s.lacunaHoras[0] && h < s.lacunaHoras[1]) continue;
    let v = nivel + (s.ruido ? gauss(r) * s.ruido : 0);
    if (s.picos && r() < s.picos) v = r() < 0.5 ? 0 : nivel * 1.3; // leitura espúria
    leituras.push({ t: ini + m * 60_000, v });
  }
  return { leituras, verdade, mascarado };
}

const opts = (cap: number) => ({ capacidadeLitros: cap });

// ---------------------------------------------------------------------------
console.log("— Calendário de Brasília");
teste("02:30 UTC ainda é o dia anterior, 23h, em Brasília", () => {
  const t = Date.parse("2026-10-05T02:30:00Z");
  assert.equal(diaBR(t), "2026-10-04");
  assert.equal(horaBR(t), 23);
});
teste("meia-noite de Brasília = 03:00 UTC, e volta para o mesmo dia", () => {
  assert.equal(inicioDiaBR("2026-10-05"), Date.parse("2026-10-05T03:00:00Z"));
  assert.equal(diaBR(inicioDiaBR("2026-10-05")), "2026-10-05");
  assert.equal(diaBR(inicioDiaBR("2026-10-05") - 1), "2026-10-04");
});
teste("somarDias atravessa mês e ano", () => {
  assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
});

console.log("— Conversões");
teste("% usa a capacidade; m³ vira litros; L fica igual", () => {
  assert.equal(paraLitros(50, "%", 20_000), 10_000);
  assert.equal(paraLitros(2.5, "m³", null), 2500);
  assert.equal(paraLitros(700, "L", null), 700);
});
teste("formatarVolume: L para pequeno, m³ para grande", () => {
  assert.equal(formatarVolume(850), "850 L");
  assert.equal(formatarVolume(45_300), "45,3 m³");
});
teste("mediana móvel remove pico isolado", () => {
  assert.deepEqual(filtroMediana([100, 100, 0, 100, 100]), [100, 100, 100, 100, 100]);
});

console.log("— Nível de reservatório");
teste("sem bomba, sem ruído: consumo exato e pico às 19h", () => {
  const { leituras, verdade } = simularDia({ capacidade: 100_000, inicial: 95_000 });
  const r = agregarDia(leituras, "NIVEL_RESERVATORIO", opts(100_000));
  perto(r.consumoLitros, verdade, 0.01, "consumo");
  assert.equal(r.reabastecidoLitros, 0);
  assert.equal(r.consumoEstimadoLitros, 0);
  assert.equal(r.horaPico, 19);
  perto(r.porHora[19], 70 * 60, 0.08, "consumo das 19h");
  assert.equal(r.cobertura, 1);
});

const BOMBA = { vazao: 300, liga: 0.4, desliga: 0.9 };
teste("com bomba: estimativa do enchimento recupera o consumo mascarado", () => {
  const { leituras, verdade, mascarado } = simularDia({ capacidade: 20_000, inicial: 15_000, bomba: BOMBA });
  const r = agregarDia(leituras, "NIVEL_RESERVATORIO", opts(20_000));
  assert.ok(mascarado > verdade * 0.05, "o cenário precisa ter enchimentos relevantes");
  assert.ok(r.reabastecidoLitros > 0, "deveria registrar reabastecimento");
  perto(r.consumoLitros, verdade, 0.06, "consumo total (medido + estimado)");
  perto(r.consumoEstimadoLitros, mascarado, 0.35, "consumo estimado durante enchimentos");
  // Sem a estimativa, o consumo ficaria visivelmente subestimado:
  assert.ok(r.consumoLitros - r.consumoEstimadoLitros < verdade * 0.97, "só o medido deveria subestimar");
});

teste("com bomba + ruído do sensor + leituras espúrias: erro ≤ 8%", () => {
  const limpo = simularDia({ capacidade: 20_000, inicial: 15_000, bomba: BOMBA });
  const sujo = simularDia({ capacidade: 20_000, inicial: 15_000, bomba: BOMBA, ruido: 10, picos: 0.005, seed: 7 });
  const r = agregarDia(sujo.leituras, "NIVEL_RESERVATORIO", opts(20_000));
  perto(r.consumoLitros, sujo.verdade, 0.08, "consumo com ruído");
  const rLimpo = agregarDia(limpo.leituras, "NIVEL_RESERVATORIO", opts(20_000));
  perto(r.consumoLitros, rLimpo.consumoLitros, 0.05, "ruído não deveria mudar muito o resultado");
});

teste("sensor offline das 2h às 5h: cobertura 21/24 e consumo preservado", () => {
  const { leituras, verdade } = simularDia({ capacidade: 100_000, inicial: 95_000, lacunaHoras: [2, 5] });
  const r = agregarDia(leituras, "NIVEL_RESERVATORIO", opts(100_000));
  assert.equal(r.cobertura, 21 / 24);
  perto(r.consumoLitros, verdade, 0.02, "consumo com lacuna");
});

teste("leitura a cada 5 min ainda dá consumo correto", () => {
  const { leituras, verdade } = simularDia({ capacidade: 20_000, inicial: 15_000, bomba: BOMBA, intervaloMin: 5 });
  const r = agregarDia(leituras, "NIVEL_RESERVATORIO", opts(20_000));
  perto(r.consumoLitros, verdade, 0.08, "consumo a cada 5 min");
});

teste("leituras fora de ordem dão o mesmo resultado", () => {
  const { leituras } = simularDia({ capacidade: 20_000, inicial: 15_000, bomba: BOMBA });
  const a = agregarDia(leituras, "NIVEL_RESERVATORIO", opts(20_000));
  const embaralhadas = [...leituras].sort((x, y) => ((x.t * 7919) % 1000) - ((y.t * 7919) % 1000));
  const b = agregarDia(embaralhadas, "NIVEL_RESERVATORIO", opts(20_000));
  assert.equal(b.consumoLitros, a.consumoLitros);
});

teste("dia sem leituras", () => {
  const r = agregarDia([], "NIVEL_RESERVATORIO", opts(20_000));
  assert.equal(r.consumoLitros, 0);
  assert.equal(r.amostras, 0);
  assert.equal(r.cobertura, 0);
  assert.equal(r.horaPico, null);
});

console.log("— Hidrômetro (consumo acumulado)");
teste("soma os incrementos e ignora o reset do contador", () => {
  const ini = inicioDiaBR(DIA);
  const leituras: Leitura[] = [];
  for (let h = 0; h <= 12; h++) leituras.push({ t: ini + h * 3_600_000, v: 12_000 + h * 100 }); // +1200
  for (let h = 13; h < 24; h++) leituras.push({ t: ini + h * 3_600_000 + 60_000, v: (h - 13) * 110 }); // reset → +1100
  const r = agregarDia(leituras, "CONSUMO_ACUMULADO");
  assert.equal(r.consumoLitros, 1200 + 1100);
  assert.equal(r.reabastecidoLitros, 0);
});

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} TESTE(S) FALHARAM`);
process.exit(falhas === 0 ? 0 : 1);
