// Testes das análises do relatório de água (src/lib/agua-relatorio.ts — funções puras).
// Rodar: npx tsx scripts/teste-agua-relatorio.ts  (ou npm run test:agua)
import assert from "node:assert/strict";
import {
  analisarPeriodo,
  destaques,
  diasEntre,
  listarDias,
  periodoAnterior,
  resolverPeriodo,
  rotuloDia,
  pct,
  type DiaRelatorio,
} from "../src/lib/agua-relatorio";

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

/** Dia sintético: consumo distribuído por um perfil (madrugada baixa, picos 8h e 19h). */
const PERFIL = [2, 2, 2, 2, 2, 3, 6, 9, 9, 7, 6, 6, 6, 6, 5, 5, 6, 7, 9, 10, 8, 6, 4, 3];
function dia(d: string, litros: number, extra: Partial<DiaRelatorio> = {}): DiaRelatorio {
  const soma = PERFIL.reduce((s, v) => s + v, 0);
  return {
    dia: d,
    consumoLitros: litros,
    consumoEstimadoLitros: litros * 0.1,
    porHora: PERFIL.map((v) => (v / soma) * litros),
    horaPico: 19,
    cobertura: 1,
    amostras: 720,
    problema: null,
    ...extra,
  };
}

console.log("— Período");
teste("padrão = últimos 30 dias até ontem", () => {
  const p = resolverPeriodo(undefined, "2026-10-05");
  assert.equal(p.preset, "30d");
  assert.equal(p.ate, "2026-10-04");
  assert.equal(p.de, "2026-09-05");
  assert.equal(diasEntre(p.de, p.ate), 30);
});
teste("mês atual vai até ontem e permite projeção; no dia 1º vira mês anterior", () => {
  const p = resolverPeriodo("mes", "2026-10-05");
  assert.deepEqual([p.de, p.ate, p.mesCorrente], ["2026-10-01", "2026-10-04", "2026-10"]);
  const d1 = resolverPeriodo("mes", "2026-10-01");
  assert.deepEqual([d1.preset, d1.de, d1.ate], ["mes-anterior", "2026-09-01", "2026-09-30"]);
});
teste("mês anterior atravessa o ano", () => {
  const p = resolverPeriodo("mes-anterior", "2027-01-10");
  assert.deepEqual([p.de, p.ate, p.rotulo], ["2026-12-01", "2026-12-31", "dezembro de 2026"]);
});
teste("mês específico (AAAA-MM), inclusive fevereiro", () => {
  const p = resolverPeriodo(undefined, "2026-10-05", { mes: "2026-02" });
  assert.deepEqual([p.de, p.ate], ["2026-02-01", "2026-02-28"]);
});
teste("personalizado: inverte datas trocadas, corta no ontem e limita a 1 ano", () => {
  const a = resolverPeriodo("personalizado", "2026-10-05", { de: "2026-10-20", ate: "2026-09-01" });
  assert.deepEqual([a.de, a.ate], ["2026-09-01", "2026-10-04"]);
  const b = resolverPeriodo("personalizado", "2026-10-05", { de: "2024-01-01", ate: "2026-10-04" });
  assert.equal(diasEntre(b.de, b.ate), 366);
  const c = resolverPeriodo("personalizado", "2026-10-05", { de: "lixo", ate: "2026-09-01" });
  assert.equal(c.preset, "30d", "data inválida cai no padrão");
});
teste("período anterior: mês → mês anterior inteiro; N dias → N dias antes", () => {
  assert.deepEqual(
    periodoAnterior(resolverPeriodo("mes", "2026-10-05")),
    { de: "2026-09-01", ate: "2026-09-30", rotulo: "setembro de 2026", curto: "setembro de 2026" }
  );
  const p = periodoAnterior(resolverPeriodo("30d", "2026-10-05"));
  assert.deepEqual([p.de, p.ate, p.curto], ["2026-08-06", "2026-09-04", "30 dias anteriores"]);
});

console.log("— Análise");
const SET = listarDias("2026-09-01", "2026-09-30");
const base = SET.map((d) => dia(d, 36_000));
teste("totais, média, estimativa e projeção do mês", () => {
  const r = analisarPeriodo(base, { de: "2026-09-01", ate: "2026-09-30", mesCorrente: "2026-09" });
  assert.equal(r.totalConfiavelLitros, 30 * 36_000);
  assert.equal(r.mediaDiariaLitros, 36_000);
  assert.equal(r.estimativaPeriodoLitros, 30 * 36_000);
  assert.equal(r.projecaoMesLitros, 30 * 36_000);
  assert.equal(r.qualidade.confiaveis, 30);
  assert.equal(r.atipicos.length, 0);
});
teste("dias incompletos, com defeito e sem registro ficam fora das médias", () => {
  const ds = base.map((d, i) =>
    i === 0 ? { ...d, cobertura: 0.3, consumoLitros: 5_000 } : i === 1 ? { ...d, problema: "TRAVADO", consumoLitros: 0 } : d
  );
  const semDois = ds.filter((d) => d.dia !== "2026-09-30" && d.dia !== "2026-09-29");
  const r = analisarPeriodo(semDois, { de: "2026-09-01", ate: "2026-09-30", mesCorrente: null });
  assert.equal(r.mediaDiariaLitros, 36_000);
  assert.deepEqual(
    [r.qualidade.confiaveis, r.qualidade.incompletos, r.qualidade.comDefeito, r.qualidade.semLeitura],
    [26, 1, 1, 2]
  );
  assert.equal(r.estimativaPeriodoLitros, 36_000 * 30, "estimativa completa os dias sem dado com a média");
});
teste("ranking: maiores/menores sem repetir dia; atípicos a ±30% da mediana", () => {
  const ds = base.map((d) =>
    d.dia === "2026-09-29" ? dia(d.dia, 50_000) : d.dia === "2026-09-22" ? dia(d.dia, 13_000) : d
  );
  const r = analisarPeriodo(ds, { de: "2026-09-01", ate: "2026-09-30", mesCorrente: null });
  assert.equal(r.maiores[0].dia, "2026-09-29");
  assert.equal(r.menores[0].dia, "2026-09-22");
  assert.equal(r.maiores.length, 5);
  assert.ok(r.menores.every((m) => !r.maiores.includes(m)), "menores não repetem os maiores");
  assert.deepEqual(r.atipicos.map((a) => a.dia.dia), ["2026-09-22", "2026-09-29"]);
  assert.equal(pct(r.atipicos[1].variacao), "+39%");
});
teste("poucos dias: sem mediana/atípicos e 'menores' vazio", () => {
  const r = analisarPeriodo(base.slice(0, 4), { de: "2026-09-01", ate: "2026-09-04", mesCorrente: null });
  assert.equal(r.medianaLitros, null);
  assert.equal(r.atipicos.length, 0);
  assert.equal(r.maiores.length, 4);
  assert.equal(r.menores.length, 0);
});
teste("comparação com o período anterior pela média diária", () => {
  const ant = listarDias("2026-08-01", "2026-08-31").map((d) => dia(d, 30_000));
  const r = analisarPeriodo(base, { de: "2026-09-01", ate: "2026-09-30", mesCorrente: null }, ant);
  assert.equal(r.mediaAnteriorLitros, 30_000);
  assert.equal(pct(r.variacaoMedia!), "+20%");
});
teste("dia da semana e perfil por hora", () => {
  const ds = base.map((d) => (new Date(`${d.dia}T12:00:00Z`).getUTCDay() === 0 ? dia(d.dia, 48_000) : d));
  const r = analisarPeriodo(ds, { de: "2026-09-01", ate: "2026-09-30", mesCorrente: null });
  assert.equal(r.porDiaSemana[0].mediaLitros, 48_000); // domingo
  assert.equal(r.porDiaSemana[1].mediaLitros, 36_000);
  assert.equal(r.horaPico, 19);
  assert.ok(r.madrugadaFracaoDoPico! < 0.35, "perfil normal: madrugada baixa");
});
teste("cobertura dos últimos 7 dias detecta sensor ficando offline", () => {
  const ds = base.map((d) => (d.dia >= "2026-09-25" ? { ...d, cobertura: 0.3 } : d));
  const r = analisarPeriodo(ds, { de: "2026-09-01", ate: "2026-09-30", mesCorrente: null });
  assert.equal(r.qualidade.offlineRecente, true);
  assert.equal(analisarPeriodo(base, { de: "2026-09-01", ate: "2026-09-30", mesCorrente: null }).qualidade.offlineRecente, false);
});

console.log("— Destaques");
teste("madrugada alta, atípicos, variação e offline viram textos", () => {
  const madrugada = (d: string) => ({ ...dia(d, 36_000), porHora: Array(24).fill(1500) }); // perfil plano
  const ds = SET.map((d) => (d === "2026-09-22" ? { ...madrugada(d), consumoLitros: 10_000 } : madrugada(d))).map((d) =>
    d.dia >= "2026-09-26" ? { ...d, cobertura: 0.4 } : d
  );
  const ant = listarDias("2026-08-01", "2026-08-31").map((d) => dia(d, 30_000));
  const txt = destaques(analisarPeriodo(ds, { de: "2026-09-01", ate: "2026-09-30", mesCorrente: null }, ant), "agosto de 2026");
  const tudo = txt.join(" | ");
  assert.match(tudo, /Consumo de madrugada alto/);
  assert.match(tudo, /atípico/);
  assert.match(tudo, /em relação a agosto de 2026/);
  assert.match(tudo, /falhas de leitura/);
});
teste("sem dias confiáveis: um aviso só", () => {
  const txt = destaques(analisarPeriodo([], { de: "2026-09-01", ate: "2026-09-30", mesCorrente: null }));
  assert.equal(txt.length, 1);
  assert.match(txt[0], /Sem nenhum dia/);
});
teste("rótulos de dia", () => {
  assert.equal(rotuloDia("2026-09-29", true), "ter, 29/09");
  assert.equal(rotuloDia("2026-09-29"), "29/09/2026");
});

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} TESTE(S) FALHARAM`);
process.exit(falhas === 0 ? 0 : 1);
