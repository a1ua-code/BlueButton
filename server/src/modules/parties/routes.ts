// /api/games and host actions on /api/parties  OWNER: B
// (Listing, viewing and joining parties is C's - see modules/participation.)
import { param } from "../../lib/params";
import { Router } from "express";
import { notYet } from "../../lib/notYet";
import { parse } from "../../lib/validate";
import { currentUser, requireUser } from "../../middleware/auth";
import { createPartySchema, hostStatusSchema } from "./schemas";
import * as parties from "./service";

export const gamesRouter = Router();
export const partiesHostRouter = Router();

gamesRouter.get("/", async (_req, res) => {
  res.json({ games: await parties.listGames() });
});

// Create a party. The response tells the client where to go next (the chat room, FR-36).
partiesHostRouter.post("/", requireUser, async (req, res) => {
  const input = parse(createPartySchema, req.body);
  const party = await parties.createParty(currentUser(req), input);
  res.status(201).json({ party: { id: party.id }, redirectTo: `/parties/${party.id}/chat` });
});

partiesHostRouter.post("/:id/status", requireUser, async (req, res) => {
  const { status } = parse(hostStatusSchema, req.body);
  res.json({ status: await parties.setStatusByHost(param(req, "id"), currentUser(req), status) });
});

partiesHostRouter.post("/:id/cancel", requireUser, async (req, res) => {
  res.json({ status: await parties.cancelParty(param(req, "id"), currentUser(req)) });
});

// Planned routes, not built yet (they answer 501). Replace with real handlers.
partiesHostRouter.patch("/:id", requireUser, notYet("Editing a party (FR-61)"));
partiesHostRouter.post("/:id/transfer-host", requireUser, notYet("Transferring host (FR-64)"));
partiesHostRouter.delete(
  "/:id/members/:userId",
  requireUser,
  notYet("Removing a participant (FR-69)"),
);
