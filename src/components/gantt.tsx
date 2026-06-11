import { diferencaDias, formatarData } from "@/lib/utils";
import { etapaAtrasada, diasAtraso } from "@/lib/obras";
import { cn } from "@/lib/utils";

type EtapaGantt = {
  id: string;
  nome: string;
  inicioPrev: Date;
  fimPrev: Date;
  progresso: number;
  fimReal?: Date | null;
};

export function Gantt({ etapas }: { etapas: EtapaGantt[] }) {
  if (etapas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
        Adicione etapas para visualizar o cronograma.
      </p>
    );
  }

  const hoje = new Date();
  const inicios = etapas.map((e) => e.inicioPrev.getTime());
  const fins = etapas.map((e) => e.fimPrev.getTime());
  const min = new Date(Math.min(...inicios, hoje.getTime()));
  const max = new Date(Math.max(...fins, hoje.getTime()));
  const spanDias = Math.max(1, diferencaDias(min, max));

  const pos = (d: Date) => (diferencaDias(min, d) / spanDias) * 100;
  const hojePct = pos(hoje);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface p-4">
      <div className="min-w-[640px]">
        {/* régua de datas */}
        <div className="mb-2 flex justify-between text-xs text-muted">
          <span>{formatarData(min)}</span>
          <span>{formatarData(max)}</span>
        </div>

        <div className="relative space-y-2">
          {/* marcador de hoje */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-warning"
            style={{ left: `${hojePct}%` }}
            title={`Hoje: ${formatarData(hoje)}`}
          />

          {etapas.map((e) => {
            const atrasada = etapaAtrasada(e, hoje);
            const left = pos(e.inicioPrev);
            const width = Math.max(2, pos(e.fimPrev) - left);
            const dias = diasAtraso(e, hoje);
            return (
              <div key={e.id} className="grid grid-cols-[160px_1fr] items-center gap-3">
                <div className="truncate text-sm">
                  <span className="font-medium">{e.nome}</span>
                </div>
                <div className="relative h-7">
                  <div
                    className={cn(
                      "absolute top-0 flex h-7 items-center overflow-hidden rounded-md text-[11px] font-medium text-white",
                      atrasada ? "bg-danger" : "bg-primary"
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${formatarData(e.inicioPrev)} → ${formatarData(e.fimPrev)}`}
                  >
                    {/* progresso */}
                    <div
                      className="absolute inset-y-0 left-0 bg-black/20"
                      style={{ width: `${e.progresso}%` }}
                    />
                    <span className="relative z-10 px-2">
                      {e.progresso}%{atrasada ? ` · +${dias}d` : ""}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
