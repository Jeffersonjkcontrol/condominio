import { HardHat, Building2, ClipboardList, Download, Sparkles, Wrench, History } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { ehAdmin } from "@/lib/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RelatorioFinanceiroCard } from "@/components/relatorio-financeiro-card";

function RelatorioCard({
  tipo,
  nome,
  descricao,
  icon: Icon,
}: {
  tipo: string;
  nome: string;
  descricao: string;
  icon: typeof HardHat;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{nome}</p>
            <p className="text-xs text-muted">{descricao}</p>
          </div>
        </div>
        <a href={`/api/relatorios?tipo=${tipo}`} className="block">
          <Button className="w-full" type="button">
            <Download className="h-4 w-4" /> Gerar PDF
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

export default async function RelatoriosPage() {
  const session = await auth();
  const admin = ehAdmin(session?.user.papel);

  return (
    <div>
      <PageHeader
        titulo="Relatórios"
        descricao="Gere relatórios em PDF prontos para imprimir ou compartilhar."
        acao={
          admin && (
            <Link href="/assistente">
              <Button variant="outline">
                <Sparkles className="h-4 w-4" /> Pedir à IA
              </Button>
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RelatorioFinanceiroCard />
        <RelatorioCard
          tipo="obras"
          nome="Obras e atrasos"
          descricao="Obras, etapas, progresso e dias de atraso."
          icon={HardHat}
        />
        <RelatorioCard
          tipo="manutencao"
          nome="Manutenção (OS)"
          descricao="Ordens de serviço, tipo, status, prazos e custos."
          icon={Wrench}
        />
        <RelatorioCard
          tipo="fornecedores"
          nome="Fornecedores e serviços"
          descricao="Fornecedores, contatos e serviços prestados."
          icon={Building2}
        />
        <RelatorioCard
          tipo="geral"
          nome="Prestação de contas (geral)"
          descricao="Visão consolidada: KPIs, financeiro e obras."
          icon={ClipboardList}
        />
        {admin && (
          <RelatorioCard
            tipo="auditoria"
            nome="Auditoria (rastreabilidade)"
            descricao="Quem fez o quê e quando no sistema."
            icon={History}
          />
        )}
      </div>

      {admin && (
        <p className="mt-6 text-sm text-muted">
          💡 Você também pode pedir ao <strong>Assistente IA</strong> algo como “gere o relatório
          financeiro deste mês” e ele cria o PDF para você.
        </p>
      )}
    </div>
  );
}
