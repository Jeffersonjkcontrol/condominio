"use client";

import { useState } from "react";
import { ScanLine, Loader2, FileText } from "lucide-react";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModalClose } from "@/components/ui/modal";
import { CATEGORIAS_RECIBO } from "@/lib/recibos-config";
import {
  extrairValor,
  extrairData,
  sugerirCategoria,
  casarFornecedor,
} from "@/lib/ocr-parser";
import { lerPdf } from "@/lib/pdf-reader";
import { paraInputDate } from "@/lib/utils";

type Recibo = {
  id: string;
  categoria: string;
  descricao: string | null;
  valor: number;
  dataEmissao: Date;
  fornecedorId: string | null;
  obraId: string | null;
  recorrenciaId: string | null;
  status: "PENDENTE" | "CONFERIDO";
};

type Opcao = { id: string; nome: string };
type ServicoOpcao = { id: string; nome: string; valorPadrao: number | null; fornecedorId: string };

export function ReciboForm({
  action,
  recibo,
  fornecedores,
  obras,
  servicos,
  recorrencias,
}: {
  action: (formData: FormData) => void;
  recibo?: Recibo;
  fornecedores: Opcao[];
  obras: Opcao[];
  servicos: ServicoOpcao[];
  recorrencias: Opcao[];
}) {
  const close = useModalClose();
  const [ocrStatus, setOcrStatus] = useState<string>("");
  const [lendo, setLendo] = useState(false);
  const [texto, setTexto] = useState("");
  const [valor, setValor] = useState(recibo ? String(recibo.valor) : "");
  const [categoria, setCategoria] = useState(recibo?.categoria ?? "");
  const [fornecedorId, setFornecedorId] = useState(recibo?.fornecedorId ?? "");
  const [data, setData] = useState(
    recibo ? paraInputDate(recibo.dataEmissao) : paraInputDate(new Date())
  );

  // Serviços do fornecedor selecionado (ou todos, se nenhum fornecedor escolhido).
  const servicosVisiveis = fornecedorId
    ? servicos.filter((s) => s.fornecedorId === fornecedorId)
    : servicos;

  function aoEscolherServico(servicoId: string) {
    const s = servicos.find((x) => x.id === servicoId);
    if (!s) return;
    if (s.valorPadrao != null) setValor(String(s.valorPadrao));
    setFornecedorId(s.fornecedorId);
  }

  async function lerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ehImagem = file.type.startsWith("image/");
    const ehPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!ehImagem && !ehPdf) {
      setOcrStatus("Formato não suportado para leitura. Anexe imagem ou PDF.");
      return;
    }

    setLendo(true);
    setOcrStatus("Lendo recibo… (pode levar alguns segundos)");
    try {
      let t = "";
      if (ehPdf) {
        t = await lerPdf(file, setOcrStatus);
      } else {
        const { default: Tesseract } = await import("tesseract.js");
        const { data: result } = await Tesseract.recognize(file, "por", {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setOcrStatus(`Reconhecendo texto… ${Math.round(m.progress * 100)}%`);
            }
          },
        });
        t = result.text || "";
      }
      setTexto(t);
      const v = extrairValor(t);
      const d = extrairData(t);
      if (v != null) setValor(String(v));
      if (d) setData(d);

      const detectados: string[] = [];
      if (v != null) detectados.push("valor");
      if (d) detectados.push("data");

      const fornecId = casarFornecedor(t, fornecedores);
      if (fornecId) {
        setFornecedorId(fornecId);
        detectados.push("fornecedor");
      }
      const cat = sugerirCategoria(t);
      if (cat && !categoria) {
        setCategoria(cat);
        detectados.push("categoria");
      }

      setOcrStatus(
        detectados.length
          ? `Leitura concluída. Detectado(s): ${detectados.join(", ")} — confira abaixo.`
          : "Leitura concluída, mas não consegui detectar os campos. Preencha manualmente."
      );
    } catch {
      setOcrStatus("Não foi possível ler o recibo automaticamente. Preencha manualmente.");
    } finally {
      setLendo(false);
    }
  }

  return (
    <form action={action} onSubmit={() => setTimeout(close, 50)} className="space-y-4">
      {recibo && <input type="hidden" name="id" value={recibo.id} />}
      <input type="hidden" name="textoExtraido" value={texto} />
      <input
        type="hidden"
        name="dadosExtraidos"
        value={JSON.stringify({ valorDetectado: valor, dataDetectada: data })}
      />

      <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-4">
        <Label htmlFor="arquivo" className="flex items-center gap-2">
          <ScanLine className="h-4 w-4" />
          {recibo
            ? "Anexar a conta (imagem ou PDF) — lê e atualiza os campos"
            : "Anexar recibo (imagem ou PDF — leitura automática)"}
        </Label>
        <Input
          id="arquivo"
          name="arquivo"
          type="file"
          accept="image/*,application/pdf"
          onChange={lerArquivo}
          className="cursor-pointer pt-2"
        />
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          {lendo && <Loader2 className="h-3 w-3 animate-spin" />}
          {ocrStatus ||
            (recibo
              ? "Selecione o PDF/foto da conta deste mês para anexar e preencher o valor."
              : "")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="categoria">Categoria *</Label>
          <Select
            id="categoria"
            name="categoria"
            required
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Selecione…</option>
            {CATEGORIAS_RECIBO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="fornecedorId">Fornecedor</Label>
          <Select
            id="fornecedorId"
            name="fornecedorId"
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
          >
            <option value="">— Sem fornecedor —</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {servicosVisiveis.length > 0 && (
        <div>
          <Label htmlFor="servico">Serviço (opcional — preenche o valor padrão)</Label>
          <Select id="servico" defaultValue="" onChange={(e) => aoEscolherServico(e.target.value)}>
            <option value="">— Escolher serviço —</option>
            {servicosVisiveis.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
                {s.valorPadrao != null
                  ? ` — ${s.valorPadrao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                  : ""}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="obraId">Vincular a uma obra (opcional)</Label>
          <Select id="obraId" name="obraId" defaultValue={recibo?.obraId ?? ""}>
            <option value="">— Sem vínculo —</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">Entra no “realizado” da obra.</p>
        </div>
        <div>
          <Label htmlFor="recorrenciaId">Vincular a conta fixa (opcional)</Label>
          <Select id="recorrenciaId" name="recorrenciaId" defaultValue={recibo?.recorrenciaId ?? ""}>
            <option value="">— Sem vínculo —</option>
            {recorrencias.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">
            Ao vincular, o valor estimado da conta fixa é atualizado com o valor deste recibo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="valor">Valor (R$) *</Label>
          <Input
            id="valor"
            name="valor"
            type="number"
            step="0.01"
            min="0"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="dataEmissao">Data de emissão *</Label>
          <Input
            id="dataEmissao"
            name="dataEmissao"
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={recibo?.status ?? "PENDENTE"}>
            <option value="PENDENTE">Pendente</option>
            <option value="CONFERIDO">Conferido</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          name="descricao"
          defaultValue={recibo?.descricao ?? ""}
          placeholder="Ex.: Pagamento referente a..."
        />
      </div>

      {texto && (
        <details className="rounded-lg border border-border p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <FileText className="h-4 w-4" /> Texto extraído do recibo
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted">
            {texto}
          </pre>
        </details>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={close}>
          Cancelar
        </Button>
        <Button type="submit" disabled={lendo}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
