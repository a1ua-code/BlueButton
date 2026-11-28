// One party's page with the Join button. OWNER: C (join/leave) + B (host controls box)
// SRS FR-46 to FR-52, IR-13 to IR-17, FR-67, FR-68.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { errorMessage, fieldErrors } from "../api/client";
import { cancelParty, fetchParty, joinParty, kickPartyMember, reportPartyNoShow, leaveParty, setPartyStatus, transferPartyHost } from "../api/parties";
import type { PartyDetail } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  ErrorBox,
  LoadingBlock,
  StatusBadge,
  SelectField,
  TextField,
  useToast,
} from "../components/ui";
import { AVAILABILITY_LABEL } from "../lib/constants";
import { formatDateTime } from "../lib/format";

export function PartyDetailPage() {
  const { id = "" } = useParams();
  const {
    data: party,
    isPending,
    error,
  } = useQuery({ queryKey: ["party", id], queryFn: () => fetchParty(id) });

  if (isPending) return <LoadingBlock />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">
                {party.locked && <span aria-label="Password protected">🔒 </span>}
                {party.title}
              </h1>
              <p className="text-slate-500">{party.gameName}</p>
            </div>
            <StatusBadge status={party.status} />
          </div>

          {/* Main facts first (IR-13) */}
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Fact label="When">{formatDateTime(party.startAt)} (KST)</Fact>
            <Fact label="Where">
              {party.locationName}
              {party.region && <span className="text-slate-400"> · {party.region}</span>}
              {party.address && (
                <span className="block text-sm text-slate-500">{party.address}</span>
              )}
            </Fact>
            <Fact label="Players">
              {party.memberCount} / {party.capacity}
            </Fact>
            <Fact label="Game">
              {AVAILABILITY_LABEL[party.availability]}
              {party.availabilityNote && (
                <span className="block text-sm text-slate-500">{party.availabilityNote}</span>
              )}
            </Fact>
            <Fact label="Host">{party.host.nickname}</Fact>
            {party.beginnerFriendly && (
              <Fact label="Level">
                <Badge tone="green">Beginner friendly</Badge>
              </Fact>
            )}
          </dl>

          {party.description && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-700">About this party</h2>
              <p className="whitespace-pre-line text-slate-700">{party.description}</p>
            </div>
          )}
        </Card>

        {/* TODO (B): rule videos "How to play" (FR-131) and a map (FR-14) go here */}

        {party.members && (
          <Card>
            <h2 className="mb-3 font-semibold">Members</h2>
            <ul className="flex flex-wrap gap-2">
              {party.members.map((m) => (
                <li key={m.id}>
                  <Badge tone={m.role === "HOST" ? "blue" : "gray"}>
                    {m.nickname}
                    {m.role === "HOST" && " (host)"}
                    {party.isHost && m.noShow && " (no-show recorded)"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <JoinBox party={party} />
        {party.isHost && <HostControls party={party} />}
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}

/** Join / open chat / leave. OWNER: C */
function JoinBox({ party }: { party: PartyDetail }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["party", party.id] });
    queryClient.invalidateQueries({ queryKey: ["parties"] });
    queryClient.invalidateQueries({ queryKey: ["my-parties"] });
  };

  const join = useMutation({
    mutationFn: () => joinParty(party.id, party.locked ? password : undefined),
    onSuccess: (res) => {
      refresh();
      toast.success("You joined the party!");
      navigate(res.redirectTo);
    },
    onError: (err) => {
      setConfirmOpen(false);
      const fields = fieldErrors(err);
      if (fields.password) setPasswordError(fields.password);
      else toast.error(errorMessage(err));
      refresh(); // e.g. the party just filled up: show the real state
    },
  });

  const leave = useMutation({
    mutationFn: () => leaveParty(party.id),
    onSuccess: (res) => {
      setLeaveOpen(false);
      refresh();
      toast.info(res.lateCancellation ? "Late cancellation recorded (+0.5 penalty points)." : "You left the party.");
    },
    onError: (err) => {
      setLeaveOpen(false);
      toast.error(errorMessage(err));
    },
  });

  if (party.isMember) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-slate-600">You are in this party.</p>
        <ButtonLink to={`/parties/${party.id}/chat`} className="w-full" size="lg">
          💬 Open chat
        </ButtonLink>
        {!party.isHost && (
          <>
            <Button variant="secondary" className="w-full" onClick={() => setLeaveOpen(true)}>
              Leave party
            </Button>
            <ConfirmDialog
              open={leaveOpen}
              title="Leave this party?"
              confirmLabel="Leave"
              danger
              loading={leave.isPending}
              onConfirm={() => leave.mutate()}
              onClose={() => setLeaveOpen(false)}
            >
              {new Date(party.startAt) > new Date() && new Date(party.startAt).getTime() - Date.now() < 12 * 60 * 60 * 1000
                ? "This is a late cancellation (within 12 hours). It adds 0.5 penalty points."
                : new Date(party.startAt) <= new Date()
                  ? "After the game starts, you can leave only once 24 hours have passed."
                  : "You can join again later if there are still seats."}
            </ConfirmDialog>
          </>
        )}
      </Card>
    );
  }

  const seatsLeft = party.capacity - party.memberCount;
  const started = new Date(party.startAt) <= new Date();
  const blocked =
    party.status === "CANCELLED"
      ? "This party was cancelled."
      : started
        ? "This party has already started."
        : party.status === "CLOSED"
          ? "The host closed this party."
          : party.status === "FULL"
            ? "This party is full."
            : null;

  return (
    <Card className="space-y-3">
      {blocked ? (
        // Not joinable: no active Join button (IR-09)
        <p className="rounded-lg bg-slate-100 p-3 text-center text-sm text-slate-600">{blocked}</p>
      ) : !user ? (
        <>
          <p className="text-sm text-slate-600">Log in to join this party.</p>
          <ButtonLink to={`/login?next=/parties/${party.id}`} className="w-full" size="lg">
            Log in to join
          </ButtonLink>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {seatsLeft === 1 ? "Only 1 seat left." : `${seatsLeft} seats left.`}
          </p>
          {party.locked && (
            <TextField
              label="Party password"
              type="password"
              required
              value={password}
              error={passwordError}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
            />
          )}
          <Button
            className="w-full"
            size="lg"
            onClick={() =>
              party.locked && !password
                ? setPasswordError("Enter the party password.")
                : setConfirmOpen(true)
            }
          >
            {seatsLeft === 1 ? "Take the last seat" : "Join party"}
          </Button>
          {/* Commitment confirmation to reduce no-shows; can always be cancelled (IR-16, IR-17) */}
          <ConfirmDialog
            open={confirmOpen}
            title="Can you make it?"
            confirmLabel={`Yes, I can make it`}
            cancelLabel="Not now"
            loading={join.isPending}
            onConfirm={() => join.mutate()}
            onClose={() => setConfirmOpen(false)}
          >
            <p>
              <strong>{formatDateTime(party.startAt)}</strong> at{" "}
              <strong>{party.locationName}</strong>.
            </p>
            <p className="mt-2">Please only join if you can come - the host is counting on you.</p>
          </ConfirmDialog>
        </>
      )}
      <p className="text-center text-xs text-slate-400">
        <Link to="/" className="hover:underline">
          ← Back to all parties
        </Link>
      </p>
    </Card>
  );
}

/** Host-only actions. OWNER: B  (TODO: edit, transfer host, kick, no-show) */
function HostControls({ party }: { party: PartyDetail }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [leaveHostOpen, setLeaveHostOpen] = useState(false);
  const [kickOpen, setKickOpen] = useState(false);
  const [kickUserId, setKickUserId] = useState("");
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [noShowUserId, setNoShowUserId] = useState("");
  const [newHostId, setNewHostId] = useState("");
  const candidates = (party.members ?? []).filter((m) => m.id !== party.host.id && m.role !== "HOST");
  const selectedHostId = candidates.some((m) => m.id === newHostId) ? newHostId : (candidates[0]?.id ?? "");
  const selectedKickId = candidates.some((m) => m.id === kickUserId) ? kickUserId : (candidates[0]?.id ?? "");
  const noShowCandidates = candidates.filter((m) => !m.noShow);
  const selectedNoShowId = noShowCandidates.some((m) => m.id === noShowUserId) ? noShowUserId : (noShowCandidates[0]?.id ?? "");
  const partyStarted = new Date(party.startAt) <= new Date();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["party", party.id] });
    queryClient.invalidateQueries({ queryKey: ["parties"] });
    queryClient.invalidateQueries({ queryKey: ["my-parties"] });
  };

  const toggle = useMutation({
    mutationFn: () => setPartyStatus(party.id, party.status === "CLOSED" ? "RECRUITING" : "CLOSED"),
    onSuccess: (r) => {
      refresh();
      toast.success(r.status === "CLOSED" ? "Recruiting closed" : "Recruiting reopened");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const cancel = useMutation({
    mutationFn: () => cancelParty(party.id),
    onSuccess: () => {
      refresh();
      toast.info("Party cancelled. Members were notified in the chat.");
      navigate("/my-parties");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const transfer = useMutation({
    mutationFn: () => transferPartyHost(party.id, selectedHostId),
    onSuccess: ({ transfer: result }) => {
      setTransferOpen(false);
      refresh();
      toast.success(`${result.newHostNickname} is now the host.`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const kick = useMutation({
    mutationFn: () => kickPartyMember(party.id, selectedKickId),
    onSuccess: () => {
      setKickOpen(false);
      setKickUserId("");
      refresh();
      toast.success("Participant removed and blocked from rejoining this party.");
    },
    onError: (err) => { toast.error(errorMessage(err)); refresh(); },
  });

  const noShow = useMutation({
    mutationFn: () => reportPartyNoShow(party.id, selectedNoShowId),
    onSuccess: ({ result }) => {
      setNoShowOpen(false);
      setNoShowUserId("");
      refresh();
      toast.info(result.suspendedUntil
        ? `No-show recorded. Suspension until ${new Date(result.suspendedUntil).toLocaleDateString()}.`
        : "No-show recorded (1 point total for this party).");
    },
    onError: (err) => { toast.error(errorMessage(err)); refresh(); },
  });

  const leaveAsHost = useMutation({
    mutationFn: () => leaveParty(party.id),
    onSuccess: ({ deleted }) => {
      setLeaveHostOpen(false);
      refresh();
      toast.info(deleted ? "Party deleted because you were its only member." : "You left the party.");
      navigate("/my-parties");
    },
    onError: (err) => {
      setLeaveHostOpen(false);
      toast.error(errorMessage(err));
      refresh();
    },
  });

  if (party.status === "CANCELLED") return null;

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Host controls</h2>
      <Button
        variant="secondary"
        className="w-full"
        loading={toggle.isPending}
        onClick={() => toggle.mutate()}
      >
        {party.status === "CLOSED" ? "Reopen recruiting" : "Close recruiting"}
      </Button>
      <ButtonLink variant="secondary" className="w-full" to={`/parties/${party.id}/edit`}>
        Edit party
      </ButtonLink>
      {candidates.length > 0 && (
        <Button variant="secondary" className="w-full" onClick={() => setTransferOpen(true)}>
          Transfer host
        </Button>
      )}
      {partyStarted && noShowCandidates.length > 0 && (
        <Button variant="secondary" className="w-full" onClick={() => setNoShowOpen(true)}>
          Record no-show
        </Button>
      )}
      {candidates.length > 0 && (
        <Button variant="danger" className="w-full" onClick={() => setKickOpen(true)}>
          Remove participant
        </Button>
      )}
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => party.memberCount > 1 ? setTransferOpen(true) : setLeaveHostOpen(true)}
        disabled={partyStarted && party.memberCount === 1}
      >
        Leave party
      </Button>
      {party.memberCount > 1 && (
        <p className="text-xs text-slate-500">Transfer the host role before leaving this party.</p>
      )}
      {partyStarted && <p className="text-xs text-slate-500">Completed parties are preserved; host deletion by leaving is disabled.</p>}
      <ConfirmDialog
        open={transferOpen}
        title="Transfer the host role?"
        confirmLabel="Transfer host"
        loading={transfer.isPending}
        onClose={() => setTransferOpen(false)}
        onConfirm={() => {
          if (selectedHostId) transfer.mutate();
          else toast.error("There is no eligible participant to become host.");
        }}
      >
        <p className="mb-3">The selected participant becomes host, and you become a regular participant.</p>
        <SelectField label="New host" required value={selectedHostId} onChange={(e) => setNewHostId(e.target.value)}>
          {candidates.length === 0 && <option value="">No eligible participants</option>}
          {candidates.map((m) => <option key={m.id} value={m.id}>{m.nickname}</option>)}
        </SelectField>
      </ConfirmDialog>
      <ConfirmDialog
        open={noShowOpen}
        title="Record a no-show?"
        confirmLabel="Record no-show"
        loading={noShow.isPending}
        onClose={() => setNoShowOpen(false)}
        onConfirm={() => {
          if (selectedNoShowId) noShow.mutate();
          else toast.error("No eligible participant.");
        }}
      >
        <p className="mb-3">Use this only if the member did not attend. A report adds 1 point and can trigger a temporary restriction.</p>
        <SelectField label="Absent participant" required value={selectedNoShowId}
          onChange={(e) => setNoShowUserId(e.target.value)}>
          {noShowCandidates.map((m) => <option key={m.id} value={m.id}>{m.nickname}</option>)}
        </SelectField>
      </ConfirmDialog>
      <ConfirmDialog
        open={kickOpen}
        title="Remove this participant?"
        confirmLabel="Remove participant"
        danger
        loading={kick.isPending}
        onClose={() => setKickOpen(false)}
        onConfirm={() => {
          if (selectedKickId) kick.mutate();
          else toast.error("There is no eligible participant to remove.");
        }}
      >
        <p className="mb-3">The selected participant will be removed and cannot rejoin this party.</p>
        <SelectField label="Participant to remove" required value={selectedKickId}
          onChange={(e) => setKickUserId(e.target.value)}>
          {candidates.length === 0 && <option value="">No eligible participants</option>}
          {candidates.map((m) => <option key={m.id} value={m.id}>{m.nickname}</option>)}
        </SelectField>
      </ConfirmDialog>
      <ConfirmDialog
        open={leaveHostOpen}
        title="Delete this party and leave?"
        confirmLabel="Delete and leave"
        danger
        loading={leaveAsHost.isPending}
        onConfirm={() => leaveAsHost.mutate()}
        onClose={() => setLeaveHostOpen(false)}
      >
        You are the only member. Leaving will permanently delete this party and its chat.
      </ConfirmDialog>
      <Button variant="danger" className="w-full" onClick={() => setCancelOpen(true)}>
        Cancel party
      </Button>
      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this party?"
        confirmLabel="Cancel party"
        cancelLabel="Keep it"
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onClose={() => setCancelOpen(false)}
      >
        All members will be notified. This cannot be undone.
      </ConfirmDialog>
    </Card>
  );
}
