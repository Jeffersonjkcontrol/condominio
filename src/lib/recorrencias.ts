// Motor de geração automática das contas fixas (recorrências).
// Estratégia "lazy": roda quando o app é aberto (chamado no layout autenticado),
// com throttle para não executar a cada navegação. Gera os recibos vencidos que
// ainda não foram lançados, como PENDENTE (o usuário confere/ajusta o valor depois).

import { prisma } from "@/lib/prisma";

let ultimaExecucao = 0;
const INTERVALO_MS = 5 * 60 * 1000; // 5 minutos

function chaveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ultimoDiaDoMes(ano: number, mes0: number): number {
  return new Date(ano, mes0 + 1, 0).getDate();
}

/** Gera os recibos das recorrências ativas cujo vencimento já chegou e ainda não foram lançados. */
export async function gerarRecorrenciasPendentes(force = false): Promise<number> {
  const agora = Date.now();
  if (!force && agora - ultimaExecucao < INTERVALO_MS) return 0;
  ultimaExecucao = agora;

  const hoje = new Date();
  const recorrencias = await prisma.recorrencia.findMany({ where: { ativo: true } });
  let gerados = 0;

  for (const r of recorrencias) {
    // Mês inicial a considerar: o mês seguinte ao último gerado, ou o mês de criação.
    let ano: number;
    let mes0: number; // 0-11
    if (r.ultimoMesGerado && /^\d{4}-\d{2}$/.test(r.ultimoMesGerado)) {
      const [a, m] = r.ultimoMesGerado.split("-").map(Number);
      const prox = new Date(a, m, 1); // m (1-12) como índice 0-11 => mês seguinte
      ano = prox.getFullYear();
      mes0 = prox.getMonth();
    } else {
      const c = new Date(r.criadoEm);
      ano = c.getFullYear();
      mes0 = c.getMonth();
    }

    let ultimoGerado = r.ultimoMesGerado ?? null;

    // Avança mês a mês até o mês atual, gerando os que já venceram.
    while (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes0 <= hoje.getMonth())) {
      const dia = Math.min(r.diaVencimento, ultimoDiaDoMes(ano, mes0));
      const vencimento = new Date(ano, mes0, dia);

      if (vencimento > hoje) break; // ainda não venceu — para por aqui

      await prisma.recibo.create({
        data: {
          categoria: r.categoria,
          descricao: `${r.descricao} (conta fixa — ${vencimento.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })})`,
          valor: r.valor,
          dataEmissao: vencimento,
          status: "PENDENTE",
          fornecedorId: r.fornecedorId,
          recorrenciaId: r.id,
          criadoPorId: r.criadoPorId,
        },
      });
      await prisma.auditoria.create({
        data: {
          usuarioNome: "Sistema (recorrência automática)",
          acao: "CRIOU",
          entidade: "Recibo",
          detalhe: `Conta fixa lançada: ${r.descricao} — venc. ${vencimento.toLocaleDateString("pt-BR")}`,
        },
      });

      ultimoGerado = chaveMes(vencimento);
      gerados++;

      // próximo mês
      mes0++;
      if (mes0 > 11) {
        mes0 = 0;
        ano++;
      }
    }

    if (ultimoGerado && ultimoGerado !== r.ultimoMesGerado) {
      await prisma.recorrencia.update({
        where: { id: r.id },
        data: { ultimoMesGerado: ultimoGerado },
      });
    }
  }

  return gerados;
}
