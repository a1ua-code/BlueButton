// /api/games and host actions on /api/parties  OWNER: B
// (Listing, viewing and joining parties is C's - see modules/participation.)
import { param } from "../../lib/params";
import { Router } from "express";
import { z } from "zod";
import { parse } from "../../lib/validate";
import { currentUser, requireAdmin, requireUser } from "../../middleware/auth";
import * as attendance from "./attendanceService";
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
// FR-70: use distinct routes to keep attendance logic inside workstream B.
partiesHostRouter.post("/:id/members/:userId/no-show", requireUser, async (req, res) => {
  res.json({ result: await attendance.reportNoShow(
    param(req, "id"), currentUser(req), parse(z.uuid(), param(req, "userId")),
  ) });
});
partiesHostRouter.get("/attendance/me", requireUser, async (req, res) => {
  res.json(await attendance.myAttendance(currentUser(req).id));
});
// Admin APIs for workstream A to attach to its dashboard.
partiesHostRouter.get("/attendance/admin/reports", requireAdmin, async (_req, res) => {
  res.json(await attendance.adminAttendanceReports());
});
partiesHostRouter.post("/attendance/admin/incidents/:incidentId/reverse", requireAdmin, async (req, res) => {
  const reason = parse(z.object({ reason: z.string().trim().min(3).max(1000) }), req.body);
  res.json(await attendance.reverseIncident(currentUser(req), parse(z.uuid(), param(req, "incidentId")), reason.reason));
});
partiesHostRouter.post("/attendance/admin/users/:userId/lift", requireAdmin, async (req, res) => {
  res.json(await attendance.liftSuspensions(currentUser(req), parse(z.uuid(), param(req, "userId"))));
});
partiesHostRouter.delete("/:id/members/:userId", requireUser, async (req, res) => {
  res.json({ result: await parties.kickParticipant(
    param(req, "id"), currentUser(req), parse(z.uuid(), param(req, "userId")),
  ) });
});
