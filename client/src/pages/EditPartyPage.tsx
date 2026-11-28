// OWNER B: Host/Admin edit form (SRS FR-61, FR-62, FR-63).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { errorMessage, fieldErrors } from "../api/client";
import { fetchGames, fetchPartyForEdit, updateParty, type EditableParty } from "../api/parties";
import type { Availability } from "../api/types";
import {
  Button,
  ButtonLink,
  Card,
  Checkbox,
  ErrorBox,
  LoadingBlock,
  PageHeader,
  SelectField,
  TextAreaField,
  TextField,
  useToast,
} from "../components/ui";
import { AVAILABILITY_LABEL, PARTY_TITLE_MAX } from "../lib/constants";

const OTHER_GAME = "__other__";
// The project displays Korean Standard Time, independent of the browser's time zone.
const toKstInput = (iso: string) =>
  new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
const fromKstInput = (value: string) => new Date(`${value}:00+09:00`).toISOString();

export function EditPartyPage() {
  const { id = "" } = useParams();
  const party = useQuery({ queryKey: ["party-edit", id], queryFn: () => fetchPartyForEdit(id) });
  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames });

  if (party.isPending) return <LoadingBlock label="Loading party settings..." />;
  if (party.error) return <ErrorBox error={party.error} />;
  return <EditForm party={party.data} games={games.data ?? []} />;
}

function EditForm({ party, games }: { party: EditableParty; games: { id: string; name: string }[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removePassword, setRemovePassword] = useState(false);
  const [form, setForm] = useState({
    title: party.title,
    gameSelection: party.gameId ?? OTHER_GAME,
    customGameName: party.gameId ? "" : party.gameName,
    capacity: String(party.capacity),
    startAt: toKstInput(party.startAt),
    locationName: party.locationName,
    address: party.address ?? "",
    region: party.region ?? "",
    availability: party.availability,
    availabilityNote: party.availabilityNote ?? "",
    description: party.description ?? "",
    beginnerFriendly: party.beginnerFriendly,
    newPassword: "",
  });
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
  }

  const save = useMutation({
    mutationFn: () => {
      const selection = form.gameSelection;
      return updateParty(party.id, {
        title: form.title.trim(),
        gameId: selection !== OTHER_GAME ? selection : undefined,
        gameName: selection === OTHER_GAME ? form.customGameName.trim() : undefined,
        capacity: Number(form.capacity),
        startAt: fromKstInput(form.startAt),
        locationName: form.locationName.trim(),
        address: form.address.trim(),
        region: form.region.trim(),
        availability: form.availability as Availability,
        availabilityNote: form.availabilityNote.trim(),
        description: form.description.trim(),
        beginnerFriendly: form.beginnerFriendly,
        password: removePassword ? undefined : form.newPassword || undefined,
        removePassword,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party", party.id] });
      queryClient.invalidateQueries({ queryKey: ["party-edit", party.id] });
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      queryClient.invalidateQueries({ queryKey: ["my-parties"] });
      toast.success("Party updated.");
      navigate(`/parties/${party.id}`);
    },
    onError: (error) => {
      setErrors(fieldErrors(error));
      toast.error(errorMessage(error));
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (Number(form.capacity) < party.memberCount) {
      setErrors({ capacity: `Cannot be below ${party.memberCount} current members.` });
      return;
    }
    if (!form.startAt) {
      setErrors({ startAt: "Choose a date and start time." });
      return;
    }
    if (form.gameSelection === OTHER_GAME && !form.customGameName.trim()) {
      setErrors({ gameName: "Enter the board game name." });
      return;
    }
    setErrors({});
    save.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit party" subtitle="Changes to game, time and place will be announced to participants." />
      <Card>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <TextField label="Party title" required maxLength={PARTY_TITLE_MAX} value={form.title}
            error={errors.title} onChange={(e) => set("title", e.target.value)} />
          <SelectField label="Board game" required value={form.gameSelection} error={errors.gameId}
            onChange={(e) => set("gameSelection", e.target.value)}>
            {games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
            <option value={OTHER_GAME}>Other — custom game</option>
          </SelectField>
          {form.gameSelection === OTHER_GAME && (
            <TextField label="Game name" required maxLength={60} value={form.customGameName}
              error={errors.gameName} onChange={(e) => set("customGameName", e.target.value)} />
          )}
          <TextField label="Capacity (including host)" required type="number" min={2} max={50}
            value={form.capacity} error={errors.capacity} hint={`${party.memberCount} current members`}
            onChange={(e) => set("capacity", e.target.value)} />
          <TextField label="Date and start time (KST)" required type="datetime-local"
            value={form.startAt} error={errors.startAt} onChange={(e) => set("startAt", e.target.value)} />
          <TextField label="Meeting place" required value={form.locationName} error={errors.locationName}
            onChange={(e) => set("locationName", e.target.value)} />
          <TextField label="Street address" value={form.address} error={errors.address}
            onChange={(e) => set("address", e.target.value)} />
          <TextField label="Area / region" value={form.region} error={errors.region}
            onChange={(e) => set("region", e.target.value)} />
          <SelectField label="Who brings the game?" required value={form.availability}
            error={errors.availability} onChange={(e) => set("availability", e.target.value as Availability)}>
            {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((a) => (
              <option key={a} value={a}>{AVAILABILITY_LABEL[a]}</option>
            ))}
          </SelectField>
          <TextField label="Game availability note" value={form.availabilityNote}
            error={errors.availabilityNote} onChange={(e) => set("availabilityNote", e.target.value)} />
          <TextAreaField label="Description" maxLength={2000} value={form.description}
            error={errors.description} onChange={(e) => set("description", e.target.value)} />
          <Checkbox label="Beginner friendly" checked={form.beginnerFriendly}
            onChange={(e) => set("beginnerFriendly", e.target.checked)} />
          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
            <legend className="px-2 text-sm font-medium">Password protection</legend>
            <p className="text-sm text-slate-600">
              {party.locked ? "A password is currently set. Leave the field empty to keep it." : "This party has no password."}
            </p>
            <TextField label="New password" type="password" value={form.newPassword}
              disabled={removePassword} error={errors.password} hint="At least 4 characters; leave blank to keep the existing setting."
              onChange={(e) => set("newPassword", e.target.value)} />
            {party.locked && (
              <Checkbox label="Remove party password" checked={removePassword}
                onChange={(e) => setRemovePassword(e.target.checked)} />
            )}
          </fieldset>
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
            <ButtonLink to={`/parties/${party.id}`} variant="secondary">Cancel</ButtonLink>
            <Button type="submit" loading={save.isPending}>Save changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
