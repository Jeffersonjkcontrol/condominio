"use client";

import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";
import { TIPOS_EVENTO, LOCAIS_EVENTO } from "@/lib/eventos";

type Evento = {
  id: string;
  titulo: string;
  tipo: string;
  local: string | null;
  descricao: string | null;
  dataInicio: Date;
  dataFim: Date;
  reservante: string | null;
  responsavelId: string | null;
  status: string;
};

type Opcao = { id: string; nome: string };

/** Date -> valor de <input type="datetime-local"> em horário local (yyyy-MM-ddTHH:mm). */
function paraInputDateTime(d?: Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function EventoForm({
  action,
  evento,
  responsaveis,
}: {
  action: (formData: FormData) => void;
  evento?: Evento;
  responsaveis: Opcao[];
}) {
  const close = useModalClose();
  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      {evento && <input type="hidden" name="id" value={evento.id} />}
      <div>
        <Label htmlFor="titulo">Título *</Label>
        <Input id="titulo" name="titulo" required defaultValue={evento?.titulo} placeholder="Ex.: Assembleia geral / Reserva do salão" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tipo">Tipo</Label>
          <Select id="tipo" name="tipo" defaultValue={evento?.tipo ?? "Outro"}>
            {TIPOS_EVENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="local">Local / espaço</Label>
          <Select id="local" name="local" defaultValue={evento?.local ?? ""}>
            <option value="">— Sem local específico —</option>
            {LOCAIS_EVENTO.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">
            Com local definido, o sistema impede reservas no mesmo espaço e horário.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="dataInicio">Início *</Label>
          <Input
            id="dataInicio"
            name="dataInicio"
            type="datetime-local"
            required
            defaultValue={paraInputDateTime(evento?.dataInicio ?? new Date())}
          />
        </div>
        <div>
          <Label htmlFor="dataFim">Término *</Label>
          <Input
            id="dataFim"
            name="dataFim"
            type="datetime-local"
            required
            defaultValue={paraInputDateTime(evento?.dataFim ?? new Date())}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="reservante">Reservante / unidade</Label>
          <Input
            id="reservante"
            name="reservante"
            defaultValue={evento?.reservante ?? ""}
            placeholder="Ex.: Apto 32 — João"
          />
        </div>
        <div>
          <Label htmlFor="responsavelId">Responsável</Label>
          <Select id="responsavelId" name="responsavelId" defaultValue={evento?.responsavelId ?? ""}>
            <option value="">— Sem responsável —</option>
            {responsaveis.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" defaultValue={evento?.descricao ?? ""} />
      </div>
      {evento && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="cancelado"
            defaultChecked={evento.status === "CANCELADO"}
            className="h-4 w-4 rounded border-border"
          />
          Cancelado
        </label>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={close}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
