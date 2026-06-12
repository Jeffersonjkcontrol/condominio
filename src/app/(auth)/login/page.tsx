import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";
import { BrandLogo } from "@/components/brand-logo";
import { getConfiguracao } from "@/lib/config";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  const config = await getConfiguracao();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo logoData={config.logoData} nome={config.nomeCondominio} variant="login" />
          <p className="mt-2 text-sm text-muted">Acesse com suas credenciais</p>
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
