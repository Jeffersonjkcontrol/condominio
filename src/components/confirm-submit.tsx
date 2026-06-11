"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmSubmit({
  confirmacao = "Tem certeza que deseja excluir? Esta ação não pode ser desfeita.",
}: {
  confirmacao?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      type="submit"
      title="Excluir"
      onClick={(e) => {
        if (!confirm(confirmacao)) e.preventDefault();
      }}
    >
      <Trash2 className="h-4 w-4 text-danger" />
    </Button>
  );
}
