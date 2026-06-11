"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  action,
  id,
  confirmacao = "Tem certeza que deseja excluir? Esta ação não pode ser desfeita.",
}: {
  action: (formData: FormData) => void;
  id: string;
  confirmacao?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmacao)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" size="icon" type="submit" title="Excluir">
        <Trash2 className="h-4 w-4 text-danger" />
      </Button>
    </form>
  );
}
