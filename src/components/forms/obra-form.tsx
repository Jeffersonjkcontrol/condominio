"use client";

import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";
import { paraInputDate } from "@/lib/utils";

type Obra = {
  id: string;
  titulo: string;
  descricao: string | null;
  orcamento: number | null;
  dataInicioPrev: Date;
  dataFimPrev: Date;
  status: string;
  responsavelId: string | null;
};

type UserOpcao = { id: string; nome: string };

export function ObraForm({
  action,
  obra,
  responsaveis,
}: {
  action: (formData: FormData) => void;
  obra?: Obra;
  responsaveis: UserOpcao[];
}) {
  const close = useModalClose();
  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      {obra && <input type="hidden" name="id" value={obra.id} />}
      <div>
        <Label htmlFor="titulo">Título *</Label>
        <Input id="titulo" name="titulo" required defaultValue={obra?.titulo} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="dataInicioPrev">Início previsto *</Label>
          <Input
            id="dataInicioPrev"
            name="dataInicioPrev"
            type="date"
            required
            defaultValue={paraInputDate(obra?.dataInicioPrev ?? new Date())}
          />
        </div>
        <div>
          <Label htmlFor="dataFimPrev">Término previsto *</Label>
          <Input
            id="dataFimPrev"
            name="dataFimPrev"
            type="date"
            required
            defaultValue={paraInputDate(obra?.dataFimPrev ?? new Date())}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="orcamento">Orçamento (R$)</Label>
        <Input
          id="orcamento"
          name="orcamento"
          type="number"
          step="0.01"
          min="0"
          defaultValue={obra?.orcamento ?? ""}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="concluida"
            defaultChecked={obra?.status === "CONCLUIDA"}
            className="h-4 w-4 rounded border-border"
          />
          Marcar obra como concluída
        </label>
        <p className="mt-1 text-xs text-muted">
          O status (Planejada, Em andamento, Atrasada) é calculado automaticamente pelas datas e
          pelo progresso das etapas. Use isto apenas para encerrar a obra manualmente.
        </p>
      </div>
      <div>
        <Label htmlFor="responsavelId">Responsável</Label>
        <Select id="responsavelId" name="responsavelId" defaultValue={obra?.responsavelId ?? ""}>
          <option value="">— Sem responsável —</option>
          {responsaveis.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" defaultValue={obra?.descricao ?? ""} />
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
