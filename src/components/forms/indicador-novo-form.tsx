"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CamposTipoIndicador } from "@/components/forms/campos-tipo-indicador";

type Device = { label: string; name: string; variaveis: string[] };
/** Uma chave de API (null = principal) e os devices que ela enxerga — sem a chave em si. */
type Conexao = { id: string | null; nome: string; devices: Device[] };

/** Formulário de novo indicador com device e variável escolhidos por menu (auto-preenchidos da plataforma).
 *  Com mais de uma chave, o menu agrupa os devices por chave e a chave certa vai junto. */
export function IndicadorNovoForm({
  action,
  conexoes,
}: {
  action: (formData: FormData) => void;
  conexoes: Conexao[];
}) {
  // Cada opção = (chave, device): o mesmo deviceLabel pode existir em duas organizações.
  const opcoes = conexoes.flatMap((c) =>
    c.devices.map((d) => ({ valor: `${c.id ?? ""}::${d.label}`, conexaoId: c.id ?? "", dev: d }))
  );
  const [sel, setSel] = useState(opcoes[0]?.valor ?? "");
  const atual = opcoes.find((o) => o.valor === sel);
  const agrupar = conexoes.filter((c) => c.devices.length > 0).length > 1;

  const opcao = (c: Conexao, d: Device) => (
    <option key={`${c.id ?? ""}::${d.label}`} value={`${c.id ?? ""}::${d.label}`}>
      {d.name} ({d.label})
    </option>
  );

  return (
    // O React 19 reseta o <form> depois da action: o DOM volta ao padrão, mas o estado não.
    // Sem o onReset, o menu mostraria o 1º device e os campos ocultos enviariam o anterior.
    <form
      action={action}
      onReset={() => setSel(opcoes[0]?.valor ?? "")}
      className="grid grid-cols-1 gap-2 sm:grid-cols-6"
    >
      <Input name="nome" required placeholder="Nome (ex.: Pressão da água)" className="sm:col-span-2" />

      <input type="hidden" name="deviceLabel" value={atual?.dev.label ?? ""} />
      <input type="hidden" name="conexaoId" value={atual?.conexaoId ?? ""} />
      <Select
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        aria-label="Device"
        className="sm:col-span-2"
      >
        {agrupar
          ? conexoes
              .filter((c) => c.devices.length > 0)
              .map((c) => (
                <optgroup key={c.id ?? ""} label={`Chave: ${c.nome}`}>
                  {c.devices.map((d) => opcao(c, d))}
                </optgroup>
              ))
          : conexoes.flatMap((c) => c.devices.map((d) => opcao(c, d)))}
      </Select>

      {/* key força recriar o select ao trocar de device → seleciona a 1ª variável do device novo */}
      <Select key={sel} name="variableLabel" defaultValue={atual?.dev.variaveis[0] ?? ""} aria-label="Variável">
        {(atual?.dev.variaveis ?? []).map((v) => (
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
