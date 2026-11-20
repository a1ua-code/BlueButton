import type { HTMLAttributes } from "react";

/** White rounded box used for most content blocks. */
export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      {...rest}
    />
  );
}
