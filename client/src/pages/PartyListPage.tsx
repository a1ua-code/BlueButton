// Home page: browse and search parties. OWNER: C  (SRS FR-40 to FR-45, IR-03, IR-07, IR-08)
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { fetchParties } from "../api/parties";
import type { Availability } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { PartyCard } from "../components/party/PartyCard";
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorBox,
  Input,
  LoadingBlock,
  PageHeader,
} from "../components/ui";
import { AVAILABILITY_LABEL } from "../lib/constants";

export function PartyListPage() {
  const { user } = useAuth();
  // Filters live in the URL (?q=catan&full=1) so the back button and shared links keep them.
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const includeFull = params.get("full") === "1";
  const noPassword = params.get("open") === "1";
  const availability = (params.get("avail")?.split(",").filter(Boolean) ?? []) as Availability[];
  const [search, setSearch] = useState(q);

  const filters = { q, includeFull, noPassword, availability };
  const { data, isPending, error } = useQuery({
    queryKey: ["parties", filters],
    queryFn: () => fetchParties(filters),
  });

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  function toggleAvailability(a: Availability) {
    const set = new Set(availability);
    if (set.has(a)) set.delete(a);
    else set.add(a);
    update("avail", [...set].join(",") || null);
  }

  const activeFilters = !!(q || includeFull || noPassword || availability.length);

  return (
    <div>
      <PageHeader
        title={user ? `Hi ${user.nickname}, let's play!` : "Find people to play board games with"}
        subtitle="Join a party, or create your own in three steps."
        actions={
          <ButtonLink to="/create" size="lg">
            ➕ Create party
          </ButtonLink>
        }
      />

      {/* Search and filters (IR-08) */}
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update("q", search.trim() || null);
        }}
      >
        <Input
          placeholder="Search by party title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search parties"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((a) => (
          <FilterChip
            key={a}
            active={availability.includes(a)}
            onClick={() => toggleAvailability(a)}
          >
            {AVAILABILITY_LABEL[a]}
          </FilterChip>
        ))}
        <FilterChip active={noPassword} onClick={() => update("open", noPassword ? null : "1")}>
          No password
        </FilterChip>
        <FilterChip active={includeFull} onClick={() => update("full", includeFull ? null : "1")}>
          Show full &amp; closed
        </FilterChip>
        {activeFilters && (
          <button
            type="button"
            className="ml-1 text-brand-700 hover:underline"
            onClick={() => {
              setSearch("");
              setParams({}, { replace: true });
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {isPending ? (
        <LoadingBlock label="Loading parties..." />
      ) : error ? (
        <ErrorBox error={error} />
      ) : data.parties.length === 0 ? (
        <EmptyState
          title="No parties match your search"
          action={<ButtonLink to="/create">Create the first one</ButtonLink>}
        >
          Try removing some filters, or create a party yourself.
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">{data.total} parties</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.parties.map((p) => (
              <PartyCard key={p.id} party={p} />
            ))}
          </div>
          {/* TODO (C): pagination when data.total > data.pageSize */}
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 ${
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {active && "✓ "}
      {children}
    </button>
  );
}
