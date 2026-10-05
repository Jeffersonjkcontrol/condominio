import { redirect } from "next/navigation";
import { Building2, Sparkles, Check, X, Image as ImageIcon, Brain, Gauge, Plus, KeyRound } from "lucide-react";
import { auth } from "@/auth";
import { ehAdmin } from "@/lib/permissoes";
import { getConfiguracao } from "@/lib/config";
import { catalogoNexus } from "@/lib/nexus";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { salvarConfiguracao, removerChave, salvarLogo, removerLogo } from "@/app/actions/config";
import { criarMemoria, atualizarMemoria, excluirMemoria } from "@/app/actions/memorias";
import {
  criarIndicador,
  atualizarIndicador,
  excluirIndicador,
  criarConexaoNexus,
  atualizarConexaoNexus,
  excluirConexaoNexus,
} from "@/app/actions/indicadores";
import { IndicadorNovoForm } from "@/components/forms/indicador-novo-form";
import { CamposTipoIndicador } from "@/components/forms/campos-tipo-indicador";

type ChaveOpcao = { id: string; nome: string };

/** Menu "qual chave de API lê este sensor" (só aparece quando há chaves adicionais). */
function SeletorChave({ chaves, valor }: { chaves: ChaveOpcao[]; valor?: string | null }) {
  if (chaves.length === 0) return null;
  return (
    <Select name="conexaoId" defaultValue={valor ?? ""} aria-label="Chave de API do sensor" className="sm:col-span-2">
      <option value="">Chave: Principal</option>
      {chaves.map((c) => (
        <option key={c.id} value={c.id}>
          Chave: {c.nome}
        </option>
      ))}
    </Select>
  );
}

function StatusChave({ status }: { status?: { ok: boolean; mensagem: string } }) {
  if (!status)
    return (
      <Badge tone="default">
        <X className="mr-1 h-3 w-3" /> Sem chave
      </Badge>
    );
  return status.ok ? (
    <Badge tone="success">
      <Check className="mr-1 h-3 w-3" /> {status.mensagem}
    </Badge>
  ) : (
    <Badge tone="danger">
      <X className="mr-1 h-3 w-3" /> {status.mensagem}
    </Badge>
  );
}

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!ehAdmin(session?.user.papel)) redirect("/");

  const config = await getConfiguracao();
  const memorias = await prisma.memoriaIA.findMany({ orderBy: { criadoEm: "desc" } });
  const indicadores = await prisma.indicadorExterno.findMany({ orderBy: { ordem: "asc" } });
  // Chaves adicionais SEM o campo apiKey — o valor da chave nunca chega à página.
  const chavesAdicionais = await prisma.conexaoNexus.findMany({
    orderBy: { criadoEm: "asc" },
    select: { id: true, nome: true, _count: { select: { indicadores: true } } },
  });
  // Testa cada chave e lista os devices que ela enxerga (status + menus). Sem a chave em si.
  const catalogo = await catalogoNexus();
  const statusPrincipal = catalogo.find((c) => c.id === null);
  const conexoesComDevices = catalogo
    .filter((c) => c.devices.length > 0)
    .map(({ id, nome, devices }) => ({ id, nome, devices }));
  const chavesOpcoes: ChaveOpcao[] = chavesAdicionais.map(({ id, nome }) => ({ id, nome }));

  const provedores = [
    {
      id: "claude",
      nome: "Claude (Anthropic)",
      keyField: "claudeApiKey",
      modelField: "claudeModelo",
      modelo: config.claudeModelo,
      configurado: Boolean(config.claudeApiKey),
      ajuda: "console.anthropic.com",
    },
    {
      id: "gemini",
      nome: "Gemini (Google)",
      keyField: "geminiApiKey",
      modelField: "geminiModelo",
      modelo: config.geminiModelo,
      configurado: Boolean(config.geminiApiKey),
      ajuda: "aistudio.google.com/apikey",
    },
    {
      id: "openai",
      nome: "ChatGPT (OpenAI)",
      keyField: "openaiApiKey",
      modelField: "openaiModelo",
      modelo: config.openaiModelo,
      configurado: Boolean(config.openaiApiKey),
      ajuda: "platform.openai.com/api-keys",
    },
  ];

  return (
    <div>
      <PageHeader
        titulo="Configurações"
        descricao="Identidade do condomínio e integração com assistentes de IA."
      />

      {/* Logo — formulário próprio (upload de arquivo, independente do form principal) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" /> Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-40 items-center justify-center rounded-lg border border-border bg-surface-muted">
              {config.logoData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={config.logoData}
                  alt="Logo atual"
                  className="max-h-14 max-w-[150px] object-contain"
                />
              ) : (
                <span className="text-xs text-muted">Sem logo</span>
              )}
            </div>
            <p className="text-sm text-muted">
              Aparece no menu lateral, no topo e na tela de login. Quando há logo, ele substitui
              o ícone e o nome.
              <br />
              PNG, JPG, WEBP ou SVG · máx. 400 KB · de preferência com fundo transparente.
            </p>
          </div>
          <form action={salvarLogo} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              required
              className="block text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90"
            />
            <Button type="submit">Enviar logo</Button>
          </form>
          {config.logoData && (
            <form action={removerLogo}>
              <Button type="submit" variant="outline" size="sm">
                Remover logo
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Memória do Assistente — fatos permanentes (admin) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> Memória do Assistente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            Fatos e instruções que o Assistente IA lembra em <strong>todas</strong> as conversas
            (nomes, regras, contatos, vencimentos…). A própria IA também pode salvar memórias
            durante a conversa — todas aparecem aqui para você editar ou remover.
          </p>

          <form action={criarMemoria} className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="conteudo"
              required
              maxLength={500}
              placeholder="Ex.: O zelador é o João, telefone (19) 99999-0000"
              className="flex-1"
            />
            <Button type="submit">Adicionar</Button>
          </form>

          {memorias.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma memória cadastrada ainda.</p>
          ) : (
            <ul className="space-y-2">
              {memorias.map((m) => (
                <li key={m.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone={m.origem === "IA" ? "default" : "success"}>
                      {m.origem === "IA" ? "Salva pela IA" : "Manual"}
                    </Badge>
                    {m.criadoPorNome && (
                      <span className="text-xs text-muted">por {m.criadoPorNome}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <form
                      action={atualizarMemoria}
                      className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <Input name="conteudo" defaultValue={m.conteudo} maxLength={500} className="flex-1" />
                      <Button type="submit" variant="outline" size="sm">
                        Salvar
                      </Button>
                    </form>
                    <form action={excluirMemoria}>
                      <input type="hidden" name="id" value={m.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Excluir
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <form action={salvarConfiguracao} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Identidade
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nomeCondominio">Nome do condomínio</Label>
              <Input
                id="nomeCondominio"
                name="nomeCondominio"
                required
                defaultValue={config.nomeCondominio}
                placeholder="Ex.: Figueira"
              />
              <p className="mt-1.5 text-xs text-muted">
                Aparece no menu lateral, no topo e na tela de login.
              </p>
            </div>
            <div>
              <Label htmlFor="horasAvisoEvento">Aviso de eventos (antecedência)</Label>
              <Select
                id="horasAvisoEvento"
                name="horasAvisoEvento"
                defaultValue={String(config.horasAvisoEvento)}
              >
                <option value="12">12 horas antes</option>
                <option value="24">24 horas antes (1 dia)</option>
                <option value="48">48 horas antes (2 dias)</option>
                <option value="72">72 horas antes (3 dias)</option>
              </Select>
              <p className="mt-1.5 text-xs text-muted">
                Quando o responsável é avisado de um evento próximo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Assistentes de IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted">
              Cole a chave de API de cada provedor que deseja usar no Assistente. As chaves
              ficam apenas no servidor. Deixe em branco para manter a chave atual.
            </p>

            {provedores.map((p) => (
              <div key={p.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium text-foreground">{p.nome}</span>
                  {p.configurado ? (
                    <Badge tone="success">
                      <Check className="mr-1 h-3 w-3" /> Configurado
                    </Badge>
                  ) : (
                    <Badge tone="default">
                      <X className="mr-1 h-3 w-3" /> Sem chave
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={p.keyField}>Chave de API</Label>
                    <Input
                      id={p.keyField}
                      name={p.keyField}
                      type="password"
                      autoComplete="off"
                      placeholder={p.configurado ? "•••••••• (mantém a atual)" : "Cole a chave aqui"}
                    />
                    <p className="mt-1 text-xs text-muted">Obtenha em {p.ajuda}</p>
                  </div>
                  <div>
                    <Label htmlFor={p.modelField}>Modelo</Label>
                    <Input id={p.modelField} name={p.modelField} defaultValue={p.modelo} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" /> Indicadores externos (jkcontrol.online)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              Conexão com a plataforma IoT para exibir sensores no Dashboard (ex.: pressão da água).
              Use uma <strong>API Key</strong> com papel <strong>viewer</strong> (só leitura). A chave
              fica apenas no servidor. Deixe em branco para manter a atual.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nexusApiUrl">URL da plataforma</Label>
                <Input id="nexusApiUrl" name="nexusApiUrl" defaultValue={config.nexusApiUrl} />
              </div>
              <div>
                <Label htmlFor="nexusApiKey">API Key (viewer)</Label>
                <Input
                  id="nexusApiKey"
                  name="nexusApiKey"
                  type="password"
                  autoComplete="off"
                  placeholder={config.nexusApiKey ? "•••••••• (mantém a atual)" : "Cole a API Key (ag_…)"}
                />
              </div>
            </div>
            <div>
              <StatusChave status={statusPrincipal} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Salvar configurações</Button>
        </div>
      </form>

      {/* Remoção de chaves (fora do form principal para envio independente) */}
      <div className="mt-4 flex flex-wrap gap-2">
        {provedores
          .filter((p) => p.configurado)
          .map((p) => (
            <form key={p.id} action={removerChave}>
              <input type="hidden" name="provedor" value={p.id} />
              <Button type="submit" variant="outline" size="sm">
                Remover chave do {p.nome}
              </Button>
            </form>
          ))}
        {config.nexusApiKey && (
          <form action={removerChave}>
            <input type="hidden" name="provedor" value="nexus" />
            <Button type="submit" variant="outline" size="sm">
              Remover API Key (jkcontrol.online)
            </Button>
          </form>
        )}
      </div>

      {/* Chaves de API adicionais — sensores de outras organizações da jkcontrol.online */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Chaves de API adicionais (jkcontrol.online)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            Cada API Key só enxerga os devices da <strong>própria organização</strong>. Para usar um
            sensor de outra organização (ex.: o reservatório de outro prédio), cadastre a chave dela
            aqui — os devices aparecem no menu de sensores abaixo, e a chave principal continua
            valendo para os demais. Use chave <strong>viewer</strong> (só leitura). As chaves ficam
            apenas no servidor e não são exibidas de novo depois de salvas.
          </p>

          {chavesAdicionais.length > 0 && (
            <ul className="space-y-2">
              {chavesAdicionais.map((c) => {
                const emUso = c._count.indicadores;
                return (
                  <li key={c.id} className="rounded-lg border border-border p-3">
                    <form action={atualizarConexaoNexus} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                      <input type="hidden" name="id" value={c.id} />
                      <Input
                        name="nome"
                        required
                        defaultValue={c.nome}
                        autoComplete="off"
                        aria-label="Nome da chave"
                        className="sm:col-span-2"
                      />
                      {/* new-password: impede o navegador de preencher a senha de login aqui */}
                      <Input
                        name="apiKey"
                        type="password"
                        autoComplete="new-password"
                        placeholder="•••••••• (mantém a atual)"
                        aria-label="Nova API Key (em branco mantém a atual)"
                        className="sm:col-span-3"
                      />
                      <Button type="submit" variant="outline" size="sm" className="h-10">
                        Salvar
                      </Button>
                    </form>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <StatusChave status={catalogo.find((k) => k.id === c.id)} />
                      <span className="text-xs text-muted">
                        {emUso > 0 ? `usada por ${emUso} sensor(es)` : "nenhum sensor usa esta chave"}
                      </span>
                      <form action={excluirConexaoNexus} className="ml-auto">
                        <input type="hidden" name="id" value={c.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          disabled={emUso > 0}
                          title={emUso > 0 ? "Troque a chave dos sensores ou exclua-os antes" : undefined}
                        >
                          Excluir
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <form action={criarConexaoNexus} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
            <Input
              name="nome"
              required
              autoComplete="off"
              placeholder="Nome (ex.: Equilibrium)"
              aria-label="Nome da nova chave"
              className="sm:col-span-2"
            />
            <Input
              name="apiKey"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Cole a API Key (ag_…)"
              aria-label="Nova API Key"
              className="sm:col-span-3"
            />
            <Button type="submit" className="h-10">
              Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Indicadores externos — sensores exibidos no Dashboard */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" /> Sensores exibidos no Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            Cada item vira um card no Dashboard com o valor atual do sensor. Informe o{" "}
            <strong>deviceLabel</strong> e o <strong>variableLabel</strong> exatamente como na plataforma.
            Para <strong>reservatório</strong>, informe a capacidade (se a variável vier em %, ela é
            convertida em litros) — o consumo diário passa a ser calculado automaticamente.
          </p>

          {conexoesComDevices.length > 0 ? (
            <IndicadorNovoForm action={criarIndicador} conexoes={conexoesComDevices} />
          ) : (
            <>
              <p className="text-xs text-muted">
                {catalogo.length > 0
                  ? "Nenhum device encontrado na plataforma (confira as chaves acima)."
                  : "Configure e salve a API Key acima para escolher os sensores em menus."}
              </p>
              <form action={criarIndicador} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                <Input name="nome" required placeholder="Nome (ex.: Pressão da água)" className="sm:col-span-2" />
                <Input name="deviceLabel" required placeholder="deviceLabel" className="sm:col-span-2" />
                <Input name="variableLabel" required placeholder="variableLabel" />
                <div className="flex gap-2">
                  <Input name="unidade" placeholder="un." className="w-16" />
                  <Button type="submit" aria-label="Adicionar sensor">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <CamposTipoIndicador />
                <SeletorChave chaves={chavesOpcoes} />
              </form>
            </>
          )}

          {indicadores.length === 0 ? (
            <p className="text-sm text-muted">Nenhum sensor cadastrado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {indicadores.map((ind) => (
                <li key={ind.id} className="rounded-lg border border-border p-3">
                  <form action={atualizarIndicador} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                    <input type="hidden" name="id" value={ind.id} />
                    <Input name="nome" defaultValue={ind.nome} className="sm:col-span-2" />
                    <Input name="deviceLabel" defaultValue={ind.deviceLabel} className="sm:col-span-2" />
                    <Input name="variableLabel" defaultValue={ind.variableLabel} />
                    <div className="flex gap-2">
                      <Input name="unidade" defaultValue={ind.unidade ?? ""} className="w-16" />
                      <Button type="submit" variant="outline" size="sm">
                        Salvar
                      </Button>
                    </div>
                    <CamposTipoIndicador
                      tipo={ind.tipo}
                      capacidadeLitros={ind.capacidadeLitros}
                      reservaLitros={ind.reservaLitros}
                      leiturasDesde={ind.leiturasDesde}
                    />
                    <SeletorChave chaves={chavesOpcoes} valor={ind.conexaoId} />
                    <label
                      className={`flex items-center gap-2 text-xs text-muted ${
                        chavesOpcoes.length > 0 ? "sm:col-span-4" : "sm:col-span-6"
                      }`}
                    >
                      <input type="checkbox" name="ativo" defaultChecked={ind.ativo} /> Ativo (aparece no
                      Dashboard)
                    </label>
                  </form>
                  <form action={excluirIndicador} className="mt-2">
                    <input type="hidden" name="id" value={ind.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Excluir
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
