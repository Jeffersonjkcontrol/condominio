"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Select } from "@/components/ui/input";
import { TIPOS_INDICADOR, TIPO_INDICADOR_LABEL, calculaConsumo, type TipoIndicador } from "@/lib/agua-calc";

const DICA: Record<TipoIndicador, string> = {
  GENERICO: "Mostra o valor atual e o histórico.",
  PRESSAO: "Mostra o valor e alerta quando zera (falta de água).",
  NIVEL_RESERVATORIO: "",
  CONSUMO_ACUMULADO: "Hidrômetro com contador: consumo = soma dos incrementos.",
};

/** Tipo do sensor + (só para reservatório) capacidade e reserva de incêndio + (tipos com consumo)
 *  data a partir da qual as leituras valem. Ocupa uma linha inteira do form. */
export function CamposTipoIndicador({
  tipo = "GENERICO",
  capacidadeLitros,
  reservaLitros,
  leiturasDesde,
}: {
  tipo?: string;
  capacidadeLitros?: number | null;
  reservaLitros?: number | null;
  leiturasDesde?: string | null;
}) {
  const inicial = (TIPOS_INDICADOR as readonly string[]).includes(tipo) ? (tipo as TipoIndicador) : "GENERICO";
  const [t, setT] = useState<TipoIndicador>(inicial);

  // O React 19 reseta o <form> depois da action: o select volta ao padrão, mas o estado não
  // (mostraria "Genérico" com os campos de capacidade abertos). Ressincroniza no "reset" —
  // `inicial` já é o valor salvo quando o servidor re-renderiza.
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const aoResetar = () => setT(inicial);
    form.addEventListener("reset", aoResetar);
    return () => form.removeEventListener("reset", aoResetar);
  }, [inicial]);

  return (
    <div className="grid grid-cols-1 gap-2 sm:col-span-6 sm:grid-cols-6">
      <Select
        ref={ref}
        name="tipo"
        value={t}
        onChange={(e) => setT(e.target.value as TipoIndicador)}
        aria-label="Tipo do sensor"
        className="sm:col-span-2"
      >
        {TIPOS_INDICADOR.map((x) => (
          <option key={x} value={x}>
            {TIPO_INDICADOR_LABEL[x]}
          </option>
        ))}
      </Select>
      {t === "NIVEL_RESERVATORIO" ? (
        <>
          <Input
            name="capacidadeLitros"
            type="number"
            min="0"
            step="any"
            required
            defaultValue={capacidadeLitros ?? ""}
            placeholder="Capacidade (litros)"
            aria-label="Capacidade do reservatório em litros"
            className="sm:col-span-2"
          />
          <Input
            name="reservaLitros"
            type="number"
            min="0"
            step="any"
            defaultValue={reservaLitros ?? ""}
            placeholder="Reserva de incêndio (litros)"
            aria-label="Reserva técnica de incêndio em litros"
            className="sm:col-span-2"
          />
        </>
      ) : (
        <p className="self-center text-xs text-muted sm:col-span-4">{DICA[t]}</p>
      )}
      {calculaConsumo(t) && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted sm:col-span-6">
          Considerar leituras a partir de
          <Input
            name="leiturasDesde"
            type="date"
            defaultValue={leiturasDesde ?? ""}
            aria-label="Considerar leituras a partir de"
            className="h-9 w-auto"
          />
          <span>(opcional — ex.: data da troca do sensor; o que vier antes é ignorado no consumo)</span>
        </label>
      )}
    </div>
  );
}
