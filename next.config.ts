import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build em VPS pequena (512 MB de RAM): a checagem de tipos dentro do `next build`
  // consome muita memória e estoura o heap. Como já validamos os tipos localmente com
  // `tsc --noEmit`, pulamos essa etapa no build de produção.
  typescript: { ignoreBuildErrors: true },
  // Libera o dev server a servir os recursos client (gráficos, tema, etc.) quando o
  // app é acessado por um túnel/IP diferente de localhost (Cloudflare Tunnel / ngrok).
  // Sem isso, em modo dev o Next bloqueia esses assets e componentes client quebram.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.loca.lt",
  ],
  // Headers de segurança (defesa em profundidade) aplicados a todas as rotas.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
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
