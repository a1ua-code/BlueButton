// GET /api/parties/:id/messages  OWNER: D
// Sending happens over the socket (socket.ts), loading history over plain HTTP.
import { param } from "../../lib/params";
import { Router } from "express";
import { currentUser, requireUser } from "../../middleware/auth";
import { assertMember, listMessages } from "./service";

export const chatRouter = Router();

chatRouter.get("/:id/messages", requireUser, async (req, res) => {
  const partyId = param(req, "id");
  await assertMember(partyId, currentUser(req).id);
  const before = req.query.before ? Number(req.query.before) : undefined;
  res.json({ messages: await listMessages(partyId, before) });
});
