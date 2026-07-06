import { ImageResponse } from "next/og";

// Ícone PWA 512x512 gerado na hora (sem asset binário). Letra "F" branca sobre azul da marca.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
          color: "#ffffff",
          fontSize: 320,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        F
      </div>
    ),
    { width: 512, height: 512 }
  );
}
