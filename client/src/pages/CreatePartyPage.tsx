// Create a party in 3 steps. OWNER: B  (SRS FR-27 to FR-36, IR-18 to IR-22, NFR-14)
// TODO (B): pick location on a map / address search (FR-37), cafe suggestions (FR-38).
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage, fieldErrors } from "../api/client";
import { createParty, fetchGames } from "../api/parties";
import { PartyLocationPicker, type SelectedLocation } from "../components/PartyLocationPicker";
import type { Availability } from "../api/types";
import {
  Button,
  Card,
  Checkbox,
  PageHeader,
  SelectField,
  TextAreaField,
  TextField,
  useToast,
} from "../components/ui";
import { AVAILABILITY_HELP, AVAILABILITY_LABEL, PARTY_TITLE_MAX } from "../lib/constants";
import { formatDateTime, localInputToIso } from "../lib/format";

const STEPS = ["Game", "When & where", "Details & review"];
const OTHER_GAME = "__other__";

// Which form fields belong to which step - used to jump back to the step with an error.
const FIELD_STEP: Record<string, number> = {
  title: 0,
  gameId: 0,
  gameName: 0,
  startAt: 1,
  locationName: 1,
  region: 1,
  capacity: 1,
  availability: 1,
  availabilityNote: 1,
  description: 2,
  password: 2,
};

export function CreatePartyPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames });

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [form, setForm] = useState({
    title: "",
    gameId: "",
    gameName: "",
    startAt: "",
    locationName: "",
    address: "",
    region: "",
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    capacity: "4",
    availability: "" as Availability | "",
    availabilityNote: "",
    description: "",
    beginnerFriendly: false,
    password: "",
  });

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value =
        e.target instanceof HTMLInputElement && e.target.type === "checkbox"
          ? e.target.checked
          : e.target.value;
      setForm((f) => ({
        ...f,
        [key]: value,
        // A manually changed venue must not retain stale Kakao coordinates.
        ...(key === "locationName" || key === "address" ? { lat: undefined, lng: undefined } : {}),
      }));
      setErrors((er) => ({ ...er, [key]: "" }));
    };

  function pickLocation(location: SelectedLocation) {
    setForm((f) => ({
      ...f,
      locationName: location.name,
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      region: "",
    }));
    setErrors((previous) => ({ ...previous, locationName: "", address: "" }));
  }

  const isOtherGame = form.gameId === OTHER_GAME;
  const gameLabel = isOtherGame
    ? form.gameName
    : games.data?.find((g) => g.id === form.gameId)?.name;

  /** Quick checks before moving to the next step. The server checks everything again. */
  function validateStep(s: number) {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!form.title.trim()) e.title = "Enter a title.";
      if (!form.gameId) e.gameId = "Choose a game.";
      if (isOtherGame && !form.gameName.trim()) e.gameName = "Type the game's name.";
    }
    if (s === 1) {
      if (!form.startAt) e.startAt = "Pick a date and time.";
      else if (new Date(form.startAt) <= new Date())
        e.startAt = "Start time must be in the future.";
      if (!form.locationName.trim()) e.locationName = "Enter a meeting place.";
      if (Number(form.capacity) < 2) e.capacity = "A party needs at least 2 people.";
      if (!form.availability) e.availability = "Choose who brings the game.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await createParty({
        title: form.title.trim(),
        gameId: isOtherGame ? undefined : form.gameId,
        gameName: isOtherGame ? form.gameName.trim() : undefined,
        capacity: Number(form.capacity),
        startAt: localInputToIso(form.startAt),
        locationName: form.locationName.trim(),
        address: form.address.trim() || undefined,
        region: form.region.trim() || undefined,
        lat: form.lat,
        lng: form.lng,
        availability: form.availability as Availability,
        availabilityNote: form.availabilityNote.trim() || undefined,
        description: form.description.trim() || undefined,
        beginnerFriendly: form.beginnerFriendly,
        password: form.password || undefined,
      });
      toast.success("Party created!");
      navigate(res.redirectTo); // FR-36: straight to the party chat
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      const first = Object.keys(fields)[0];
      if (first && FIELD_STEP[first] !== undefined) setStep(FIELD_STEP[first]);
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="create-wizard mx-auto max-w-3xl">
      <p className="eyebrow mb-3 text-brand-700">MAKE ROOM FOR A GREAT NIGHT</p>
      <PageHeader
        title="Create a party"
        subtitle="Pick a game, gather your people, and let the good times roll. Fields marked * are required."
      />

      {/* Progress indicator (IR-20) */}
      <ol className="mb-6 grid grid-cols-3 gap-2 sm:gap-4" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`wizard-step ${i === step ? "wizard-step-active" : ""}`}
          >
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand-600" : "bg-slate-200"}`} />
            <p
              className={`mt-3 text-sm ${i === step ? "font-semibold text-brand-700" : "text-slate-500"}`}
            >
              {i + 1}. {label}
            </p>
          </li>
        ))}
      </ol>

      <Card>
        <div className="wizard-intro">
          <span aria-hidden="true">{["⚄", "◷", "✦"][step]}</span>
          <div>
            <p className="eyebrow text-brand-700">STEP {step + 1} OF 3</p>
            <h2>
              {["What’s hitting the table?", "Set the scene.", "Make it your kind of night."][step]}
            </h2>
          </div>
        </div>
        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 2) {
              if (validateStep(step)) setStep(step + 1);
            } else submit();
          }}
        >
          {step === 0 && (
            <>
              <SelectField
                label="Board game"
                required
                value={form.gameId}
                onChange={set("gameId")}
                error={errors.gameId}
              >
                <option value="">{games.isPending ? "Loading games..." : "Choose a game"}</option>
                {games.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value={OTHER_GAME}>Other (type the name)</option>
              </SelectField>
              {isOtherGame && (
                <TextField
                  label="Game name"
                  required
                  value={form.gameName}
                  onChange={set("gameName")}
                  error={errors.gameName}
                  maxLength={60}
                />
              )}
              <TextField
                label="Party title"
                required
                value={form.title}
                onChange={set("title")}
                error={errors.title}
                maxLength={PARTY_TITLE_MAX}
                hint={`${form.title.length}/${PARTY_TITLE_MAX} characters`}
                placeholder="e.g. Friday Catan"
              />
            </>
          )}

          {step === 1 && (
            <>
              <TextField
                label="Date and start time"
                type="datetime-local"
                required
                value={form.startAt}
                onChange={set("startAt")}
                error={errors.startAt}
              />
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">
                  Who brings the game? <span className="text-red-600">*</span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((a) => (
                    <label
                      key={a}
                      className={`cursor-pointer rounded-2xl border-2 p-4 text-sm transition-colors ${
                        form.availability === a
                          ? "border-brand-600 bg-brand-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="availability"
                        value={a}
                        checked={form.availability === a}
                        onChange={set("availability")}
                        className="mr-2 accent-brand-600"
                      />
                      <span className="font-medium">{AVAILABILITY_LABEL[a]}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {AVAILABILITY_HELP[a]}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.availability && (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {errors.availability}
                  </p>
                )}
              </fieldset>
              {form.availability === "OTHER" && (
                <TextField
                  label="Note"
                  value={form.availabilityNote}
                  onChange={set("availabilityNote")}
                  placeholder="e.g. renting from the club room"
                />
              )}
              <PartyLocationPicker cafeMode={form.availability === "CAFE"} onPick={pickLocation} />
              {form.lat !== undefined && form.lng !== undefined && (
                <p className="text-xs text-brand-700" role="status">
                  Mapped meeting location selected. The venue coordinates will be saved with this
                  party.
                </p>
              )}
              <TextField
                label="Meeting place"
                required
                value={form.locationName}
                onChange={set("locationName")}
                error={errors.locationName}
                placeholder="e.g. N1 lounge, or a cafe name"
              />
              <TextField
                label="Street address"
                value={form.address}
                onChange={set("address")}
                error={errors.address}
                placeholder="Optional: full address of the meeting place"
              />
              <TextField
                label="Area"
                value={form.region}
                onChange={set("region")}
                error={errors.region}
                placeholder="e.g. KAIST, Yuseong"
                hint="Helps people filter by location."
              />
              <TextField
                label="Number of players (including you)"
                type="number"
                min={2}
                max={50}
                required
                value={form.capacity}
                onChange={set("capacity")}
                error={errors.capacity}
              />
            </>
          )}

          {step === 2 && (
            <>
              <TextAreaField
                label="Description"
                value={form.description}
                onChange={set("description")}
                error={errors.description}
                placeholder="Rules, skill level, expected duration..."
                maxLength={2000}
              />
              <Checkbox
                label="Beginner friendly (rules will be explained)"
                checked={form.beginnerFriendly}
                onChange={set("beginnerFriendly")}
              />

              {/* Less used settings stay collapsed (IR-22) */}
              <button
                type="button"
                className="text-sm text-brand-700 hover:underline"
                onClick={() => setShowOptional((v) => !v)}
              >
                {showOptional ? "▾" : "▸"} More options
              </button>
              {showOptional && (
                <TextField
                  label="Party password"
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  error={errors.password}
                  hint="Only people with the password can join. Leave empty for a public party."
                />
              )}

              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-sm">
                <h3 className="mb-2 font-semibold">Review</h3>
                <ul className="space-y-1 text-slate-700">
                  <li>
                    <strong>{form.title}</strong> · {gameLabel}
                  </li>
                  <li>🕒 {form.startAt && formatDateTime(localInputToIso(form.startAt))}</li>
                  <li>
                    📍 {form.locationName}
                    {form.region && ` · ${form.region}`}
                    {form.address && (
                      <span className="block text-xs text-slate-500">{form.address}</span>
                    )}
                  </li>
                  <li>
                    👥 {form.capacity} players ·{" "}
                    {form.availability && AVAILABILITY_LABEL[form.availability]}
                  </li>
                </ul>
              </div>
            </>
          )}

          <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            <Button type="submit" loading={submitting}>
              {step < 2 ? "Next step" : "Create party"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
