"use client";

import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";
import { CATEGORIAS_RECIBO } from "@/lib/recibos-config";

type Recorrencia = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  diaVencimento: number;
  fornecedorId: string | null;
  ativo: boolean;
};

type Opcao = { id: string; nome: string };

export function RecorrenciaForm({
  action,
  recorrencia,
  fornecedores,
}: {
  action: (formData: FormData) => void;
  recorrencia?: Recorrencia;
  fornecedores: Opcao[];
}) {
  const close = useModalClose();
  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      {recorrencia && <input type="hidden" name="id" value={recorrencia.id} />}
      <div>
        <Label htmlFor="descricao">Descrição *</Label>
        <Input
          id="descricao"
          name="descricao"
          required
          defaultValue={recorrencia?.descricao}
          placeholder="Ex.: Conta de água, Salário do zelador"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="categoria">Categoria *</Label>
          <Select id="categoria" name="categoria" required defaultValue={recorrencia?.categoria ?? ""}>
            <option value="">Selecione…</option>
            {CATEGORIAS_RECIBO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="fornecedorId">Fornecedor</Label>
          <Select id="fornecedorId" name="fornecedorId" defaultValue={recorrencia?.fornecedorId ?? ""}>
            <option value="">— Sem fornecedor —</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="valor">Valor estimado (R$) *</Label>
          <Input
            id="valor"
            name="valor"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={recorrencia?.valor ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="diaVencimento">Dia do vencimento *</Label>
          <Input
            id="diaVencimento"
            name="diaVencimento"
            type="number"
            min="1"
            max="28"
            required
            defaultValue={recorrencia?.diaVencimento ?? 10}
          />
          <p className="mt-1 text-xs text-muted">De 1 a 28 (para valer em todos os meses).</p>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={recorrencia ? recorrencia.ativo : true}
          className="h-4 w-4 rounded border-border"
        />
        Ativa (gera recibos automaticamente todo mês)
      </label>
      <p className="rounded-lg bg-surface-muted/50 px-3 py-2 text-xs text-muted">
        💡 O recibo é lançado como <strong>pendente</strong> com o valor estimado. Quando a conta
        real chegar, anexe a foto no recibo — o OCR lê o valor e você ajusta.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={close}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
