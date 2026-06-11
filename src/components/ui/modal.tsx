"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./button";

const ModalCloseContext = React.createContext<() => void>(() => {});

/** Hook usado pelos formulários dentro do Modal para fechá-lo após salvar. */
export function useModalClose() {
  return React.useContext(ModalCloseContext);
}

export function Modal({
  trigger,
  title,
  children,
  triggerProps,
}: {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
  triggerProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} {...triggerProps}>
        {trigger}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
          <div className="absolute inset-0" onClick={close} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              <Button variant="ghost" size="icon" onClick={close} type="button">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-5">
              <ModalCloseContext.Provider value={close}>
                {children}
              </ModalCloseContext.Provider>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
