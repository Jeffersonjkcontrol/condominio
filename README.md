# Gestão de Condomínio

Sistema web para gestão de condomínio: recibos (com leitura automática por OCR e exportação),
fornecedores, serviços, obras com cronograma (Gantt) e análise de atrasos, e controle de
usuários/permissões.

## Tecnologias
- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** (UI própria, tema claro/escuro)
- **Prisma 6** + **SQLite** (local) — migração para PostgreSQL/nuvem é trocar o `provider`
- **Auth.js (NextAuth v5)** — login por e-mail/senha + papéis (RBAC)
- **Tesseract.js** — OCR de recibos no navegador
- **ExcelJS** / **pdf-lib** — exportação de relatórios
- **Recharts** — gráficos do dashboard

## Como rodar (desenvolvimento)

```bash
npm install
npx prisma migrate dev      # cria o banco SQLite (prisma/dev.db)
npm run db:seed             # popula dados de exemplo + usuários
npm run dev                 # http://localhost:3000
```

### Usuários de exemplo (seed)
| Papel            | E-mail                     | Senha      | Acesso                                  |
|------------------|----------------------------|------------|-----------------------------------------|
| Síndico/Admin    | sindico@condominio.com     | admin123   | Tudo, incluindo gestão de usuários      |
| Gestor           | gestor@condominio.com      | gestor123  | Cria/edita recibos, fornecedores, obras |

> Usuários com papel **USUARIO** têm acesso somente de leitura.

## Scripts
- `npm run dev` — servidor de desenvolvimento
- `npm run build` / `npm start` — produção
- `npm run db:migrate` — aplica migrações do Prisma
- `npm run db:seed` — popula dados de exemplo
- `npm run db:studio` — abre o Prisma Studio (inspeção do banco)

## Módulos
- **Dashboard** — KPIs (gastos do mês, recibos pendentes, obras ativas, etapas atrasadas),
  gráficos de gastos por categoria/mês e ranking de obras atrasadas.
- **Recibos** — cadastro com anexo; OCR automático (imagem) extrai valor/data; exportação
  para Excel e PDF.
- **Fornecedores / Serviços** — CRUD com serviços vinculados a cada fornecedor.
- **Obras** — CRUD, etapas, cronograma (Gantt em CSS), cálculo automático de atrasos e
  **Orçado × Realizado** (recibos vinculados à obra somam o realizado, com alerta de estouro).
- **Eventos** — agenda do condomínio (assembleias, reuniões, confraternizações, manutenções) e
  **reserva de espaços comuns** (salão, churrasqueira, quadra) com **bloqueio de conflito** de
  horário no mesmo local. Visão em agenda agrupada por dia, com busca/filtros (tipo, local,
  próximos/passados) e paginação. Status automático por data (Agendado/Em andamento/Concluído).
- **Contas fixas (recorrências)** — despesas mensais (água, luz, zelador…) que o sistema lança
  automaticamente como recibo pendente **ao abrir o app** (geração lazy, sem servidor 24h). Usa
  valor estimado; quando a conta real chega, o OCR lê o valor e você ajusta. Recupera meses perdidos.
- **Manutenção** — Ordens de Serviço (OS) com numeração automática, **tipo** (Jardinagem,
  Elétrica, Hidráulica, Pintura, etc.), prioridade, prazo e **sub-OS** (tarefas dentro de cada OS).
  Status automático (Atrasada por data, Concluída quando todas as sub-OS terminam), barra de
  progresso e **histórico** da OS.
- **Notificações** — central no app (sininho 🔔 no topo, com contador) que avisa: OS de
  manutenção atrasada, obra atrasada, orçamento de obra estourado e conta fixa/recibo pendente.
  O **admin escolhe quem recebe** (marca "Recebe notificações" por usuário). Gera ao abrir o app,
  sem duplicar.
- **Auditoria** — rastreabilidade de todos os processos: cada criação/edição/exclusão/conclusão
  registra quem fez, o quê e quando. Página filtrável (somente Admin) e histórico por OS.
- **Relatórios** — gera PDFs prontos: financeiro mensal, obras/atrasos, **manutenção (OS)**,
  fornecedores, **auditoria** (admin) e prestação de contas geral. Financeiro e auditoria permitem
  escolher o mês de referência.
- **Usuários** — gestão de acessos e papéis (somente Admin).
- **Assistente IA** (somente Admin) — chat integrado a **Claude (Anthropic)**, **Gemini (Google)**
  e **ChatGPT (OpenAI)**. Você escolhe o provedor; o assistente recebe como contexto o nome do
  condomínio e um resumo dos dados (gastos, obras, atrasos).
- **Configurações** (somente Admin) — define o **nome do condomínio** (ex.: "Figueira") e as
  **chaves de API** de cada IA. As chaves ficam apenas no servidor.

### Configurar as IAs
Em **Configurações**, cole a chave de API do(s) provedor(es) desejado(s):
- Claude: `console.anthropic.com`
- Gemini: `aistudio.google.com/apikey`
- ChatGPT: `platform.openai.com/api-keys`

Só os provedores com chave aparecem no seletor do Assistente. O modelo de cada um é editável
(padrões: `claude-sonnet-4-6`, `gemini-2.0-flash`, `gpt-4o-mini`).

O Assistente tem acesso a **todos os dados do app** (financeiro, recibos, fornecedores/serviços,
obras/etapas, manutenção/OS, usuários e auditoria) e sabe **gerar relatórios em PDF** via
*function calling* (financeiro, obras, manutenção, fornecedores, auditoria, geral): peça algo como
"gere o relatório de manutenção" e a IA chama `gerar_relatorio`; o PDF aparece como botão de
download na conversa.

**Histórico**: as conversas ficam salvas (lista lateral para reabrir/continuar/excluir).

**Bloqueio de escopo**: o assistente só responde sobre a gestão do condomínio. Pedidos claramente
fora do tema (programação, receitas, atualidades…) são recusados localmente, sem consumir a API.

## Próximo passo: nuvem
1. Trocar `provider` de `sqlite` para `postgresql` em `prisma/schema.prisma` e ajustar `DATABASE_URL`
   (ex.: Supabase) no `.env`.
2. Mover uploads de `public/uploads` para um storage (Supabase Storage / S3).
3. Gerar um novo `AUTH_SECRET` (`npx auth secret`) e fazer deploy (ex.: Vercel).
