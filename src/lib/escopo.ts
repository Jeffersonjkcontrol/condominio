// Pré-filtro local de escopo: barra pedidos claramente fora da gestão do condomínio
// ANTES de chamar a API (economiza chamadas). É conservador para não bloquear
// perguntas legítimas — casos sutis ficam a cargo do system prompt da IA.

const PADROES_FORA_ESCOPO: RegExp[] = [
  // Programação
  /\b(c[óo]digo|programa[rç]|javascript|typescript|python|java\b|html|css|sql|api rest|reactjs?)\b/i,
  /escreva?\s+(um|uma)\s+(script|programa|fun[çc][ãa]o|c[óo]digo)/i,
  // Conteúdo criativo
  /\b(poema|poesia|piada|conte\s+uma\s+hist[óo]ria|letra\s+de\s+m[úu]sica|receita\s+de)\b/i,
  // Tradução / redação escolar
  /\btraduz(a|ir)\b/i,
  /\b(reda[çc][ãa]o|trabalho\s+escolar|resolva.*(equa[çc][ãa]o|exerc[íi]cio))\b/i,
  // Conhecimento geral / atualidades
  /\b(quem\s+(ganhou|venceu|descobriu|inventou)|capital\s+d[eo]\s|previs[ãa]o\s+do\s+tempo|cota[çc][ãa]o\s+d[oe]|d[óo]lar\s+hoje|pre[çc]o\s+do\s+bitcoin)\b/i,
];

export function foraDeEscopo(texto: string): boolean {
  return PADROES_FORA_ESCOPO.some((re) => re.test(texto));
}

export function mensagemRecusa(nomeCondominio: string): string {
  return `Sou o assistente de gestão do condomínio ${nomeCondominio} e só posso ajudar com assuntos da administração: recibos e finanças, fornecedores e serviços, obras, cronogramas, atrasos e relatórios. Reformule sua pergunta dentro desse contexto que eu te ajudo. 🙂`;
}
