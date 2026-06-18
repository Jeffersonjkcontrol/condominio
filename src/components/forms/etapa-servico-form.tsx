"use client";

import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";

type EtapaServico = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  ordem: number;
};

export function EtapaServicoForm({
  action,
  etapa,
  servicoId,
  proximaOrdem,
}: {
  action: (formData: FormData) => void;
  etapa?: EtapaServico;
  servicoId: string;
  proximaOrdem?: number;
}) {
  const close = useModalClose();
  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      <input type="hidden" name="servicoId" value={servicoId} />
      {etapa && <input type="hidden" name="id" value={etapa.id} />}
      <div>
        <Label htmlFor="titulo">Título da etapa *</Label>
        <Input
          id="titulo"
          name="titulo"
          required
          defaultValue={etapa?.titulo}
          placeholder="Ex.: Preparação do terreno"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={etapa?.status ?? "PENDENTE"}>
            <option value="PENDENTE">Pendente</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="CONCLUIDA">Concluída</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="ordem">Ordem</Label>
          <Input id="ordem" name="ordem" type="number" min="0" defaultValue={etapa?.ordem ?? proximaOrdem ?? 0} />
        </div>
      </div>
      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" defaultValue={etapa?.descricao ?? ""} />
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
