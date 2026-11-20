// Page building blocks: a title row, empty states, errors and "coming soon" placeholders.
import type { ReactNode } from "react";
import { errorMessage } from "../../api/client";
import { Card } from "./Card";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-3xl" aria-hidden="true">
        🎲
      </p>
      <h2 className="mt-2 font-semibold text-slate-800">{title}</h2>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      role="alert"
    >
      {errorMessage(error)}
    </div>
  );
}

/** Placeholder for pages that a teammate has not built yet. */
export function ComingSoon({
  title,
  owner,
  requirements,
}: {
  title: string;
  owner: string;
  requirements: string;
}) {
  return (
    <div>
      <PageHeader title={title} />
      <Card className="text-center">
        <p className="text-3xl" aria-hidden="true">
          🚧
        </p>
        <p className="mt-2 font-medium">This page is not built yet.</p>
        <p className="mt-1 text-sm text-slate-500">
          Owner: <strong>{owner}</strong> · SRS {requirements}
        </p>
      </Card>
    </div>
  );
}
