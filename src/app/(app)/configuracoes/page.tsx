import { redirect } from "next/navigation";
import { Building2, Sparkles, Check, X } from "lucide-react";
import { auth } from "@/auth";
import { ehAdmin } from "@/lib/permissoes";
import { getConfiguracao } from "@/lib/config";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { salvarConfiguracao, removerChave } from "@/app/actions/config";

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!ehAdmin(session?.user.papel)) redirect("/");

  const config = await getConfiguracao();

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
      </div>
    </div>
  );
}
