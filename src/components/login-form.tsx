"use client";

import { useActionState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { autenticar, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    autenticar,
    undefined
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="voce@condominio.com"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

      {state?.erro && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.erro}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        Entrar
      </Button>
    </form>
  );
}
