"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PRESETS_PERIODO } from "@/lib/agua-relatorio";

/** Sensor + período da página /agua. Presets aplicam na hora; "Personalizado" pede as datas. */
export function AguaFiltros({
  sensores,
  sensorId,
  preset,
  de,
  ate,
}: {
  sensores: { id: string; nome: string }[];
  sensorId: string;
  preset: string;
  de: string;
  ate: string;
}) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(preset);
  const [d1, setD1] = useState(de);
  const [d2, setD2] = useState(ate);

  const ir = (sensor: string, p: string) => {
    const qs = new URLSearchParams({ sensor, periodo: p });
    if (p === "personalizado") {
      qs.set("de", d1);
      qs.set("ate", d2);
    }
    router.push(`/agua?${qs}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      {sensores.length > 1 && (
        <Select
          aria-label="Sensor"
          defaultValue={sensorId}
          onChange={(e) => ir(e.target.value, periodo)}
          className="w-auto min-w-48"
        >
          {sensores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </Select>
      )}
      <Select
        aria-label="Período"
        value={periodo}
        onChange={(e) => {
          setPeriodo(e.target.value);
          if (e.target.value !== "personalizado") ir(sensorId, e.target.value);
        }}
        className="w-auto"
      >
        {PRESETS_PERIODO.map((p) => (
          <option key={p.id} value={p.id}>
            {p.rotulo}
          </option>
        ))}
      </Select>
      {periodo === "personalizado" && (
        <>
          <Input type="date" aria-label="De" value={d1} onChange={(e) => setD1(e.target.value)} className="w-auto" />
          <Input type="date" aria-label="Até" value={d2} onChange={(e) => setD2(e.target.value)} className="w-auto" />
          <Button type="button" onClick={() => ir(sensorId, "personalizado")} disabled={!d1 || !d2}>
            Aplicar
          </Button>
        </>
      )}
    </div>
  );
}
