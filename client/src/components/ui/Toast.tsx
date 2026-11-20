// Short pop-up messages after an action, e.g. "Joined the party!" (SRS IR-06).
//
//   const toast = useToast();
//   toast.success("Party created");
//   toast.error("Could not join");
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
type ToastApi = {
  success: (t: string) => void;
  error: (t: string) => void;
  info: (t: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const api: ToastApi = {
    success: useCallback((t: string) => push("success", t), [push]),
    error: useCallback((t: string) => push("error", t), [push]),
    info: useCallback((t: string) => push("info", t), [push]),
  };

  const style = { success: "bg-emerald-600", error: "bg-red-600", info: "bg-slate-800" };
  const icon = { success: "✓", error: "!", info: "i" };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${style[t.kind]}`}
          >
            <span aria-hidden="true" className="font-bold">
              {icon[t.kind]}
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
