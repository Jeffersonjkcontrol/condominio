"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CamposTipoIndicador } from "@/components/forms/campos-tipo-indicador";

type Device = { label: string; name: string; variaveis: string[] };

/** Formulário de novo indicador com device e variável escolhidos por menu (auto-preenchidos da plataforma). */
export function IndicadorNovoForm({
  action,
  devices,
}: {
  action: (formData: FormData) => void;
  devices: Device[];
}) {
  const [devLabel, setDevLabel] = useState(devices[0]?.label ?? "");
  const dev = devices.find((d) => d.label === devLabel);

  return (
    <form action={action} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
      <Input name="nome" required placeholder="Nome (ex.: Pressão da água)" className="sm:col-span-2" />

      <Select
        name="deviceLabel"
        value={devLabel}
        onChange={(e) => setDevLabel(e.target.value)}
        className="sm:col-span-2"
      >
        {devices.map((d) => (
          <option key={d.label} value={d.label}>
            {d.name} ({d.label})
          </option>
        ))}
      </Select>

      {/* key força recriar o select ao trocar de device → seleciona a 1ª variável do device novo */}
      <Select key={devLabel} name="variableLabel" defaultValue={dev?.variaveis[0] ?? ""}>
        {(dev?.variaveis ?? []).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>

      <div className="flex gap-2">
        <Input name="unidade" placeholder="un." className="w-16" />
        <Button type="submit" aria-label="Adicionar sensor">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <CamposTipoIndicador />
    </form>
  );
}
