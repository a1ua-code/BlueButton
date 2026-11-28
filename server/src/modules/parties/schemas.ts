// Input validation for creating/editing parties (SRS FR-29 to FR-34). OWNER: B
import { z } from "zod";

export const createPartySchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title.").max(12, "At most 12 characters."), // FR-32
    gameId: z.string().optional(), // pick from the list ...
    gameName: z.string().trim().max(60).optional(), // ... or type a name (FR-30)
    capacity: z.coerce
      .number()
      .int("Must be a whole number.")
      .min(2, "A party needs at least 2 people.")
      .max(50, "At most 50 people."),
    startAt: z.coerce
      .date("Pick a date and time.")
      .refine((d) => d.getTime() > Date.now(), "Start time must be in the future."),
    locationName: z.string().trim().min(1, "Enter a meeting place.").max(100),
    address: z.string().trim().max(200).optional(),
    region: z.string().trim().max(50).optional(),
    availability: z.enum(["OWNED", "CAFE", "SEEKING", "OTHER"], "Choose who brings the game."),
    availabilityNote: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    beginnerFriendly: z.boolean().default(false),
    password: z.string().min(4, "At least 4 characters.").max(50).optional().or(z.literal("")),
  })
  .refine((v) => v.gameId || v.gameName, {
    message: "Choose a game or type its name.",
    path: ["gameId"],
  });

export type CreatePartyInput = z.infer<typeof createPartySchema>;

// Editing uses the same required fields and validation as creation (FR-61).
// Blank password means keep the old password; removePassword removes it explicitly.
export const editPartySchema = createPartySchema.safeExtend({
  removePassword: z.boolean().default(false),
}).refine((value) => !value.removePassword || !value.password, {
  path: ["password"],
  message: "Do not enter a password when removing password protection.",
});
export type EditPartyInput = z.infer<typeof editPartySchema>;

export const transferHostSchema = z.object({
  newHostUserId: z.string().uuid("Select an active party member."),
});

export const hostStatusSchema = z.object({
  status: z.enum(["RECRUITING", "CLOSED"]),
});
