"use client";

import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";
import { paraInputDate } from "@/lib/utils";

type Etapa = {
  id: string;
  nome: string;
  inicioPrev: Date;
  fimPrev: Date;
  inicioReal: Date | null;
  fimReal: Date | null;
  progresso: number;
  ordem: number;
};

export function EtapaForm({
  action,
  etapa,
  obraId,
  proximaOrdem,
  temSubEtapas = false,
}: {
  action: (formData: FormData) => void;
  etapa?: Etapa;
  obraId: string;
  proximaOrdem?: number;
  temSubEtapas?: boolean;
}) {
  const close = useModalClose();
  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      <input type="hidden" name="obraId" value={obraId} />
      {etapa && <input type="hidden" name="id" value={etapa.id} />}
      <div>
        <Label htmlFor="nome">Nome da etapa *</Label>
        <Input id="nome" name="nome" required defaultValue={etapa?.nome} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="inicioPrev">Início previsto *</Label>
          <Input
            id="inicioPrev"
            name="inicioPrev"
            type="date"
            required
            defaultValue={paraInputDate(etapa?.inicioPrev ?? new Date())}
          />
        </div>
        <div>
          <Label htmlFor="fimPrev">Término previsto *</Label>
          <Input
            id="fimPrev"
            name="fimPrev"
            type="date"
            required
            defaultValue={paraInputDate(etapa?.fimPrev ?? new Date())}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="inicioReal">Início real</Label>
          <Input
            id="inicioReal"
            name="inicioReal"
            type="date"
            defaultValue={paraInputDate(etapa?.inicioReal)}
          />
        </div>
        <div>
          <Label htmlFor="fimReal">Término real</Label>
          <Input
            id="fimReal"
            name="fimReal"
            type="date"
            defaultValue={paraInputDate(etapa?.fimReal)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {temSubEtapas ? (
          <div>
            <Label>Progresso (%)</Label>
            {/* Mantém o valor atual (calculado pelas sub-etapas) ao salvar a etapa. */}
            <input type="hidden" name="progresso" value={etapa?.progresso ?? 0} />
            <p className="mt-2 text-sm text-muted">
              Calculado automaticamente pelas sub-etapas ({etapa?.progresso ?? 0}%).
            </p>
          </div>
        ) : (
          <div>
            <Label htmlFor="progresso">Progresso (%)</Label>
            <Input
              id="progresso"
              name="progresso"
              type="number"
              min="0"
              max="100"
              defaultValue={etapa?.progresso ?? 0}
            />
          </div>
        )}
        <div>
          <Label htmlFor="ordem">Ordem</Label>
          <Input
            id="ordem"
            name="ordem"
            type="number"
            min="0"
            defaultValue={etapa?.ordem ?? proximaOrdem ?? 0}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={close}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
