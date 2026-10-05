"use client";

import { useState } from "react";
import Link from "next/link";
import { Droplets, Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PRESETS_PERIODO } from "@/lib/agua-relatorio";

/** Cartão do relatório de consumo de água em /relatorios (PDF ou Excel). */
export function RelatorioAguaCard({ sensores }: { sensores: { id: string; nome: string }[] }) {
  const [sensor, setSensor] = useState(sensores[0]?.id ?? "");
  const [periodo, setPeriodo] = useState("30d");
  const qs = new URLSearchParams({ sensor, periodo });

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Droplets className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Consumo de água</p>
            <p className="text-xs text-muted">Total, média, ranking de dias, padrões e qualidade do sensor.</p>
          </div>
        </div>
        {sensores.length > 1 && (
          <div>
            <Label htmlFor="agua-sensor">Sensor</Label>
            <Select id="agua-sensor" value={sensor} onChange={(e) => setSensor(e.target.value)}>
              {sensores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="agua-periodo">Período</Label>
          <Select id="agua-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PRESETS_PERIODO.filter((p) => p.id !== "personalizado").map((p) => (
              <option key={p.id} value={p.id}>
                {p.rotulo}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href={`/api/agua/relatorio?${qs}&formato=pdf`} className="block">
            <Button className="w-full" type="button">
              <Download className="h-4 w-4" /> PDF
            </Button>
          </a>
          <a href={`/api/agua/relatorio?${qs}&formato=xlsx`} className="block">
            <Button className="w-full" type="button" variant="outline">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          </a>
        </div>
        <Link href={`/agua?${qs}`} className="block text-center text-xs text-muted hover:text-primary">
          Ver análise na tela (ou escolher datas personalizadas)
        </Link>
      </CardContent>
    </Card>
  );
}
