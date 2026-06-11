import * as React from "react";

export function PageHeader({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted">{descricao}</p>}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}

export function EmptyState({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <p className="font-medium text-foreground">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-muted">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
