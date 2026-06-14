// Limitador simples de tentativas (anti-força-bruta), em memória.
// Adequado para uma única instância (pm2 fork). Os contadores zeram ao reiniciar o app.

const MAX_TENTATIVAS = 8; // falhas permitidas dentro da janela
const JANELA_MS = 15 * 60 * 1000; // 15 minutos

type Registro = { count: number; expira: number };
const tentativas = new Map<string, Registro>();

function agora() {
  return Date.now();
}

/** Remove ocasionalmente entradas expiradas para o mapa não crescer indefinidamente. */
function limpar() {
  if (tentativas.size < 500) return;
  const t = agora();
  for (const [k, v] of tentativas) if (t > v.expira) tentativas.delete(k);
}

/** true se a chave excedeu o limite de falhas na janela atual. */
export function estaBloqueado(chave: string): boolean {
  const r = tentativas.get(chave);
  if (!r) return false;
  if (agora() > r.expira) {
    tentativas.delete(chave);
    return false;
  }
  return r.count >= MAX_TENTATIVAS;
}

/** Registra uma falha de login para a chave. */
export function registrarFalha(chave: string): void {
  limpar();
  const r = tentativas.get(chave);
  if (!r || agora() > r.expira) {
    tentativas.set(chave, { count: 1, expira: agora() + JANELA_MS });
  } else {
    r.count++;
  }
}

/** Limpa o histórico de falhas (após um login bem-sucedido). */
export function limparTentativas(chave: string): void {
  tentativas.delete(chave);
}
