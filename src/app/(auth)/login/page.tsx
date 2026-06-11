import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";
import { getConfiguracao } from "@/lib/config";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  const config = await getConfiguracao();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{config.nomeCondominio}</h1>
          <p className="text-sm text-muted">Acesse com suas credenciais</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Não tem acesso? Solicite ao síndico/administrador.
        </p>
      </div>
    </div>
  );
}
