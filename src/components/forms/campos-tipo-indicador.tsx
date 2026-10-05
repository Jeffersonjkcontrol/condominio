"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/input";
import { TIPOS_INDICADOR, TIPO_INDICADOR_LABEL, type TipoIndicador } from "@/lib/agua-calc";

const DICA: Record<TipoIndicador, string> = {
  GENERICO: "Mostra o valor atual e o histórico.",
  PRESSAO: "Mostra o valor e alerta quando zera (falta de água).",
  NIVEL_RESERVATORIO: "",
  CONSUMO_ACUMULADO: "Hidrômetro com contador: consumo = soma dos incrementos.",
};

/** Tipo do sensor + (só para reservatório) capacidade e reserva de incêndio. Ocupa uma linha inteira do form. */
export function CamposTipoIndicador({
  tipo = "GENERICO",
  capacidadeLitros,
  reservaLitros,
}: {
  tipo?: string;
  capacidadeLitros?: number | null;
  reservaLitros?: number | null;
}) {
  const inicial = (TIPOS_INDICADOR as readonly string[]).includes(tipo) ? (tipo as TipoIndicador) : "GENERICO";
  const [t, setT] = useState<TipoIndicador>(inicial);

  return (
    <div className="grid grid-cols-1 gap-2 sm:col-span-6 sm:grid-cols-6">
      <Select
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
    </div>
  );
}
