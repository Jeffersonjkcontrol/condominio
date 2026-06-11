"use client";

import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";

type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: "ADMIN" | "GESTOR" | "USUARIO";
  ativo: boolean;
  recebeNotificacoes: boolean;
  podeUsarIA: boolean;
};

export function UsuarioForm({
  action,
  usuario,
}: {
  action: (formData: FormData) => void;
  usuario?: Usuario;
}) {
  const close = useModalClose();
  const editando = Boolean(usuario);
  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      {usuario && <input type="hidden" name="id" value={usuario.id} />}
      <div>
        <Label htmlFor="nome">Nome *</Label>
        <Input id="nome" name="nome" required defaultValue={usuario?.nome} />
      </div>
      <div>
        <Label htmlFor="email">E-mail *</Label>
        <Input id="email" name="email" type="email" required defaultValue={usuario?.email} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="papel">Papel *</Label>
          <Select id="papel" name="papel" required defaultValue={usuario?.papel ?? "USUARIO"}>
            <option value="ADMIN">Síndico / Admin</option>
            <option value="GESTOR">Gestor</option>
            <option value="USUARIO">Usuário</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="senha">
            {editando ? "Nova senha (opcional)" : "Senha *"}
          </Label>
          <Input
            id="senha"
            name="senha"
            type="password"
            minLength={6}
            required={!editando}
            placeholder={editando ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
          />
        </div>
      </div>
      {editando && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={usuario?.ativo}
            className="h-4 w-4 rounded border-border"
          />
          Usuário ativo (pode acessar o sistema)
        </label>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="recebeNotificacoes"
          defaultChecked={usuario?.recebeNotificacoes ?? false}
          className="h-4 w-4 rounded border-border"
        />
        Recebe notificações (alertas de atrasos, orçamento e contas)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="podeUsarIA"
          defaultChecked={usuario?.podeUsarIA ?? false}
          className="h-4 w-4 rounded border-border"
        />
        Pode usar o Assistente IA (o Síndico/Admin sempre pode)
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={close}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
