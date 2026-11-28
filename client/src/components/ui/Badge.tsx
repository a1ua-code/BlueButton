// Small labels. Status is always shown as text + icon, never color alone (SRS IR-35).
import type { ReactNode } from "react";
import type { PartyStatus } from "../../api/types";
import { STATUS_LABEL } from "../../lib/constants";

type Tone = "gray" | "blue" | "green" | "amber" | "red";

const tones: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const statusStyle: Record<PartyStatus, { tone: Tone; icon: string }> = {
  RECRUITING: { tone: "green", icon: "●" },
  FULL: { tone: "amber", icon: "■" },
  CLOSED: { tone: "gray", icon: "🔒︎" },
  CANCELLED: { tone: "red", icon: "✕" },
};

export function StatusBadge({ status }: { status: PartyStatus }) {
  const { tone, icon } = statusStyle[status];
  return (
    <Badge tone={tone}>
      <span aria-hidden="true">{icon}</span>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
