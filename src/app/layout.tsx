import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestão de Condomínio",
  description: "Sistema de gestão de condomínio — recibos, fornecedores e obras",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          // Evita "flash" de tema claro antes da hidratação
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('tema');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
