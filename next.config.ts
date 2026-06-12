import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Libera o dev server a servir os recursos client (gráficos, tema, etc.) quando o
  // app é acessado por um túnel/IP diferente de localhost (Cloudflare Tunnel / ngrok).
  // Sem isso, em modo dev o Next bloqueia esses assets e componentes client quebram.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.loca.lt",
  ],
  experimental: {
    serverActions: {
      // Permite anexar PDFs/fotos de contas maiores (padrão do Next é 1 MB).
      bodySizeLimit: "15mb",
      // Libera Server Actions quando o app é acessado por um túnel público
      // (Cloudflare Tunnel / ngrok) numa demonstração. Sem isso o Next bloqueia
      // os formulários por causa do domínio diferente.
      allowedOrigins: [
        "localhost:3000",
        // Produção (VPS DigitalOcean + DuckDNS)
        "figueiragarden.duckdns.org",
        "*.trycloudflare.com",
        "*.ngrok-free.app",
        "*.ngrok.io",
        "*.loca.lt",
      ],
    },
  },
};

export default nextConfig;
