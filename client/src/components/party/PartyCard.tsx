// The party card used in the list, My Parties and Bookmarks (SRS IR-07, IR-10, IR-11, IR-12).
// OWNER: C (everyone reuses it - change it here, not in your page).
import { Link } from "react-router";
import type { PartySummary } from "../../api/types";
import { AVAILABILITY_LABEL } from "../../lib/constants";
import { formatDateTime, startsSoon } from "../../lib/format";
import { Badge, StatusBadge } from "../ui";

export function PartyCard({ party, extra }: { party: PartySummary; extra?: React.ReactNode }) {
  const seatsLeft = party.capacity - party.memberCount;
  const joinable = party.status === "RECRUITING";

  return (
    <Link
      to={`/parties/${party.id}`}
      className={`group block rounded-xl border bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md ${
        joinable ? "border-slate-200" : "border-slate-200 opacity-75" // not joinable = visually muted (IR-09)
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900 group-hover:text-brand-700">
            {party.locked && (
              <span title="Password protected" aria-label="Password protected">
                🔒{" "}
              </span>
            )}
            {party.title}
          </h3>
          <p className="truncate text-sm text-slate-500">{party.gameName}</p>
        </div>
        <StatusBadge status={party.status} />
      </div>

      <dl className="mt-3 space-y-1 text-sm text-slate-600">
        <div className="flex gap-2">
          <dt className="sr-only">When</dt>
          <span aria-hidden="true">🕒</span>
          <dd>
            {formatDateTime(party.startAt)}
            {startsSoon(party.startAt) && joinable && (
              <span className="ml-2 text-xs font-medium text-amber-700">Starting soon</span>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="sr-only">Where</dt>
          <span aria-hidden="true">📍</span>
          <dd className="truncate">
            {party.locationName}
            {party.region && <span className="text-slate-400"> · {party.region}</span>}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={joinable && seatsLeft === 1 ? "amber" : "blue"}>
          👥 {party.memberCount}/{party.capacity}
          {joinable && seatsLeft === 1 && " · 1 seat left"}
        </Badge>
        <Badge>{AVAILABILITY_LABEL[party.availability]}</Badge>
        {party.beginnerFriendly && <Badge tone="green">Beginner friendly</Badge>}
        {extra}
      </div>
    </Link>
  );
}
