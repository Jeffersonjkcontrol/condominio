// Leitura de PDF no navegador: extrai o texto direto (PDF digital) ou, se for
// escaneado (sem texto), renderiza a 1ª página e roda OCR. Client-side.

type OnStatus = (s: string) => void;

export async function lerPdf(file: File, onStatus?: OnStatus): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker via CDN (mesma abordagem da internet já usada pelo Tesseract).
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(1);

  // 1) Tenta extrair o texto embutido (conta digital da Enel/CPFL, etc.).
  const tc = await page.getTextContent();
  const texto = tc.items
    .map((it) => ("str" in it ? it.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (texto.length > 30) {
    onStatus?.("PDF de texto lido diretamente.");
    return texto;
  }

  // 2) PDF escaneado (imagem) → renderiza e roda OCR.
  onStatus?.("PDF escaneado — convertendo e lendo (OCR)…");
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");

  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  const { default: Tesseract } = await import("tesseract.js");
  const { data: result } = await Tesseract.recognize(canvas, "por", {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onStatus?.(`OCR do PDF… ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  return result.text || "";
}
