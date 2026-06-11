"use client";

import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";

type SubOS = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  custo: number | null;
  ordem: number;
};

export function SubOSForm({
  action,
  sub,
  ordemId,
  proximaOrdem,
}: {
  action: (formData: FormData) => void;
  sub?: SubOS;
  ordemId: string;
  proximaOrdem?: number;
}) {
  const close = useModalClose();
  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      <input type="hidden" name="ordemId" value={ordemId} />
      {sub && <input type="hidden" name="id" value={sub.id} />}
      <div>
        <Label htmlFor="titulo">Título da sub-OS *</Label>
        <Input id="titulo" name="titulo" required defaultValue={sub?.titulo} placeholder="Ex.: Trocar registro" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={sub?.status ?? "PENDENTE"}>
            <option value="PENDENTE">Pendente</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="CONCLUIDA">Concluída</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="custo">Custo (R$)</Label>
          <Input id="custo" name="custo" type="number" step="0.01" min="0" defaultValue={sub?.custo ?? ""} />
        </div>
        <div>
          <Label htmlFor="ordem">Ordem</Label>
          <Input id="ordem" name="ordem" type="number" min="0" defaultValue={sub?.ordem ?? proximaOrdem ?? 0} />
        </div>
      </div>
      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" defaultValue={sub?.descricao ?? ""} />
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
