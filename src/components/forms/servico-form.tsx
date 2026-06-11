"use client";

import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";

type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  valorPadrao: number | null;
  unidade: string | null;
  fornecedorId: string;
};

type FornecedorOpcao = { id: string; nome: string };

export function ServicoForm({
  action,
  servico,
  fornecedorId,
  fornecedores,
}: {
  action: (formData: FormData) => void;
  servico?: Servico;
  fornecedorId?: string;
  fornecedores?: FornecedorOpcao[];
}) {
  const close = useModalClose();
  const fixarFornecedor = fornecedorId ?? servico?.fornecedorId;

  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      {servico && <input type="hidden" name="id" value={servico.id} />}

      {fornecedores ? (
        <div>
          <Label htmlFor="fornecedorId">Fornecedor *</Label>
          <Select
            id="fornecedorId"
            name="fornecedorId"
            required
            defaultValue={fixarFornecedor ?? ""}
          >
            <option value="">Selecione…</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <input type="hidden" name="fornecedorId" value={fixarFornecedor ?? ""} />
      )}

      <div>
        <Label htmlFor="nome">Nome do serviço *</Label>
        <Input id="nome" name="nome" required defaultValue={servico?.nome} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="valorPadrao">Valor padrão (R$)</Label>
          <Input
            id="valorPadrao"
            name="valorPadrao"
            type="number"
            step="0.01"
            min="0"
            defaultValue={servico?.valorPadrao ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="unidade">Unidade</Label>
          <Input
            id="unidade"
            name="unidade"
            placeholder="hora, serviço, m²…"
            defaultValue={servico?.unidade ?? ""}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" defaultValue={servico?.descricao ?? ""} />
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
