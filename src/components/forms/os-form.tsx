"use client";

import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";
import { paraInputDate } from "@/lib/utils";
import { TIPOS_MANUTENCAO } from "@/lib/manutencao";

type OS = {
  id: string;
  titulo: string;
  tipo: string;
  descricao: string | null;
  local: string | null;
  prioridade: string;
  status: string;
  custo: number | null;
  dataPrevista: Date | null;
  fornecedorId: string | null;
  responsavelId: string | null;
};

type Opcao = { id: string; nome: string };

export function OSForm({
  action,
  os,
  fornecedores,
  responsaveis,
}: {
  action: (formData: FormData) => void;
  os?: OS;
  fornecedores: Opcao[];
  responsaveis: Opcao[];
}) {
  const close = useModalClose();
  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      {os && <input type="hidden" name="id" value={os.id} />}
      <div>
        <Label htmlFor="titulo">Título *</Label>
        <Input id="titulo" name="titulo" required defaultValue={os?.titulo} placeholder="Ex.: Vazamento na garagem" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="tipo">Tipo de manutenção</Label>
          <Select id="tipo" name="tipo" defaultValue={os?.tipo ?? "Geral"}>
            {TIPOS_MANUTENCAO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="local">Local</Label>
          <Input id="local" name="local" defaultValue={os?.local ?? ""} placeholder="Ex.: Bloco B, 2º andar" />
        </div>
        <div>
          <Label htmlFor="prioridade">Prioridade</Label>
          <Select id="prioridade" name="prioridade" defaultValue={os?.prioridade ?? "MEDIA"}>
            <option value="BAIXA">Baixa</option>
            <option value="MEDIA">Média</option>
            <option value="ALTA">Alta</option>
            <option value="URGENTE">Urgente</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={os?.status ?? "ABERTA"}>
            <option value="ABERTA">Aberta</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="CONCLUIDA">Concluída</option>
            <option value="CANCELADA">Cancelada</option>
          </Select>
          <p className="mt-1 text-xs text-muted">“Atrasada” é automático pela data prevista.</p>
        </div>
        <div>
          <Label htmlFor="dataPrevista">Prazo (data prevista)</Label>
          <Input
            id="dataPrevista"
            name="dataPrevista"
            type="date"
            defaultValue={paraInputDate(os?.dataPrevista)}
          />
        </div>
        <div>
          <Label htmlFor="custo">Custo (R$)</Label>
          <Input id="custo" name="custo" type="number" step="0.01" min="0" defaultValue={os?.custo ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fornecedorId">Fornecedor</Label>
          <Select id="fornecedorId" name="fornecedorId" defaultValue={os?.fornecedorId ?? ""}>
            <option value="">— Sem fornecedor —</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="responsavelId">Responsável</Label>
          <Select id="responsavelId" name="responsavelId" defaultValue={os?.responsavelId ?? ""}>
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
        <Textarea id="descricao" name="descricao" defaultValue={os?.descricao ?? ""} />
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
