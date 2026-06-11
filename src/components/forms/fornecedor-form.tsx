"use client";

import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";

type Fornecedor = {
  id: string;
  nome: string;
  cnpjCpf: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  observacoes: string | null;
};

export function FornecedorForm({
  action,
  fornecedor,
}: {
  action: (formData: FormData) => void;
  fornecedor?: Fornecedor;
}) {
  const close = useModalClose();
  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      {fornecedor && <input type="hidden" name="id" value={fornecedor.id} />}
      <div>
        <Label htmlFor="nome">Nome *</Label>
        <Input id="nome" name="nome" required defaultValue={fornecedor?.nome} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cnpjCpf">CNPJ / CPF</Label>
          <Input id="cnpjCpf" name="cnpjCpf" defaultValue={fornecedor?.cnpjCpf ?? ""} />
        </div>
        <div>
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" defaultValue={fornecedor?.telefone ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={fornecedor?.email ?? ""} />
        </div>
        <div>
          <Label htmlFor="endereco">Endereço</Label>
          <Input id="endereco" name="endereco" defaultValue={fornecedor?.endereco ?? ""} />
        </div>
      </div>
      <div>
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" name="observacoes" defaultValue={fornecedor?.observacoes ?? ""} />
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
