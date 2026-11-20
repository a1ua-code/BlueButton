// OWNER: C  (SRS FR-56 to FR-59, IR-23, IR-24)
import { useQuery } from "@tanstack/react-query";
import { fetchMyParties } from "../api/parties";
import { PartyCard } from "../components/party/PartyCard";
import {
  Badge,
  ButtonLink,
  EmptyState,
  ErrorBox,
  LoadingBlock,
  PageHeader,
} from "../components/ui";

export function MyPartiesPage() {
  const { data, isPending, error } = useQuery({
    queryKey: ["my-parties"],
    queryFn: fetchMyParties,
  });

  if (isPending) return <LoadingBlock />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div>
      <PageHeader
        title="My parties"
        actions={<ButtonLink to="/create">➕ Create party</ButtonLink>}
      />

      <section aria-labelledby="upcoming">
        <h2 id="upcoming" className="mb-3 font-semibold text-slate-700">
          Upcoming
        </h2>
        {data.upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming parties"
            action={<ButtonLink to="/">Find a party</ButtonLink>}
          >
            Join a party or create one - it will show up here.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.upcoming.map((p) => (
              <PartyCard
                key={p.id}
                party={p}
                extra={p.isHost && <Badge tone="blue">You host</Badge>}
              />
            ))}
          </div>
        )}
      </section>

      {data.past.length > 0 && (
        <section aria-labelledby="past" className="mt-10">
          <h2 id="past" className="mb-3 font-semibold text-slate-700">
            Past parties
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.past.map((p) => (
              <PartyCard
                key={p.id}
                party={p}
                extra={p.isHost && <Badge tone="blue">You hosted</Badge>}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
