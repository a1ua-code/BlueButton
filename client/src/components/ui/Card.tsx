import type { HTMLAttributes } from "react";

/** White rounded box used for most content blocks. */
export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`clubhouse-card rounded-3xl border border-brand-100 bg-white p-5 shadow-sm sm:p-6 ${className}`}
      {...rest}
    />
  );
}
