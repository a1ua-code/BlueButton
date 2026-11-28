// Home page: browse and search parties. OWNER: C  (SRS FR-40 to FR-45, IR-03, IR-07, IR-08)
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { fetchParties } from "../api/parties";
import type { Availability } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { ClubhouseArt } from "../components/ClubhouseArt";
import { PartyCard } from "../components/party/PartyCard";
import { Button, ButtonLink, EmptyState, ErrorBox, Input, LoadingBlock } from "../components/ui";
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
      <section className="clubhouse-hero" aria-labelledby="clubhouse-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="hero-spark" aria-hidden="true">
              ✳
            </span>{" "}
            GOOD GAMES. GREAT COMPANY.
          </p>
          <h1 id="clubhouse-title">
            Your next game night <span>starts here.</span>
          </h1>
          <p className="hero-description">
            A seat at the table. A new friend. One more round. Find your board-game people, right
            here on campus.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/create" size="lg">
              Create Party
            </ButtonLink>
            <a href="#find-parties" className="hero-find">
              Find Party
            </a>
          </div>
          <p className="hero-footnote">
            <span aria-hidden="true">✦</span> Bring your competitive spirit. Beginners welcome.
          </p>
        </div>
        <ClubhouseArt />
      </section>
      <div className="clubhouse-strip" aria-label="Clubhouse spirit">
        <span>YOUR CAMPUS. YOUR CREW.</span>
        <span aria-hidden="true">✳</span>
        <span>LESS SCROLLING, MORE ROLLING.</span>
        <span aria-hidden="true">✳</span>
        <span>THERE’S A SEAT FOR YOU.</span>
      </div>
      <section id="find-parties" className="party-discovery" aria-labelledby="discovery-title">
        <div className="discovery-heading">
          <div>
            <p className="eyebrow text-brand-700">THE GAME-NIGHT LINEUP</p>
            <h2 id="discovery-title">Find your next table.</h2>
          </div>
          <p>
            {user
              ? `Hey ${user.nickname}, ready for another round?`
              : "Pick a game. Meet your people."}
          </p>
        </div>

        {/* Search and filters (IR-08) */}
        <form
          className="search-bar mb-4 flex gap-2"
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
      </section>
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
      className={`rounded-full border px-3 py-2 font-medium transition-colors ${
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
