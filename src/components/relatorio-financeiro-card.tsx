"use client";

import { useState } from "react";
import { FileText, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RelatorioFinanceiroCard() {
  const mesAtual = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);

  const url = mes
    ? `/api/relatorios?tipo=financeiro&mes=${mes}`
    : `/api/relatorios?tipo=financeiro`;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Financeiro mensal</p>
            <p className="text-xs text-muted">Recibos, total e gastos por categoria/fornecedor.</p>
          </div>
        </div>
        <div>
          <Label htmlFor="mes">Mês de referência (vazio = todos)</Label>
          <Input id="mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
        <a href={url} className="block">
          <Button className="w-full" type="button">
            <Download className="h-4 w-4" /> Gerar PDF
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
