import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Marca do condomínio. Se houver logo configurado (data URL no banco), exibe a imagem;
 * caso contrário, mostra o ícone padrão + nome (comportamento anterior).
 * - variant "sidebar": layout horizontal (menu lateral / topo)
 * - variant "login": layout vertical centralizado (tela de login)
 */
export function BrandLogo({
  logoData,
  nome,
  variant = "sidebar",
}: {
  logoData?: string | null;
  nome: string;
  variant?: "sidebar" | "login";
}) {
  if (logoData) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoData}
        alt={nome}
        className={cn(
          "object-contain",
          variant === "login" ? "max-h-20 max-w-[220px]" : "max-h-10 max-w-[190px]"
        )}
      />
    );
  }

  if (variant === "login") {
    return (
      <>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-foreground">{nome}</h1>
      </>
    );
  }

  return (
    <>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Building2 className="h-5 w-5" />
      </div>
      <span className="font-bold text-foreground">{nome}</span>
    </>
  );
}
