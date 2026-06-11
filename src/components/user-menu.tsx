"use client";

import { LogOut } from "lucide-react";
import { sair } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function UserMenu({ nome, papelLabel }: { nome: string; papelLabel: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-foreground">{nome}</p>
        <p className="text-xs text-muted">{papelLabel}</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
        {nome.slice(0, 1).toUpperCase()}
      </div>
      <form action={sair}>
        <Button variant="outline" size="icon" title="Sair" type="submit">
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
