// /api/games and host actions on /api/parties  OWNER: B
// (Listing, viewing and joining parties is C's - see modules/participation.)
import { param } from "../../lib/params";
import { Router } from "express";
import { notYet } from "../../lib/notYet";
import { parse } from "../../lib/validate";
import { currentUser, requireUser } from "../../middleware/auth";
import { createPartySchema, editPartySchema, hostStatusSchema, transferHostSchema } from "./schemas";
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

// Host/admin-only settings; never send password hashes back to the browser.
partiesHostRouter.get("/:id/edit", requireUser, async (req, res) => {
  res.json({ party: await parties.getPartyForEdit(param(req, "id"), currentUser(req)) });
});
partiesHostRouter.patch("/:id", requireUser, async (req, res) => {
  const input = parse(editPartySchema, req.body);
  res.json({ party: await parties.editParty(param(req, "id"), currentUser(req), input) });
});

// Other planned routes still return 501 until implemented.
partiesHostRouter.post("/:id/transfer-host", requireUser, async (req, res) => {
  const { newHostUserId } = parse(transferHostSchema, req.body);
  res.json({ transfer: await parties.transferHost(param(req, "id"), currentUser(req), newHostUserId) });
});
partiesHostRouter.delete(
  "/:id/members/:userId",
  requireUser,
  notYet("Removing a participant (FR-69)"),
);
