// GET /api/parties, GET /api/parties/:id, join/leave, /api/me/parties  OWNER: C
import { param } from "../../lib/params";
import { Router } from "express";
import { z } from "zod";
import { notYet } from "../../lib/notYet";
import { parse } from "../../lib/validate";
import { currentUser, requireUser } from "../../middleware/auth";
import * as participation from "./service";

export const partiesPublicRouter = Router();
export const meRouter = Router();

const listQuery = z.object({
  q: z.string().trim().optional(),
  gameId: z.string().optional(),
  region: z.string().trim().optional(),
  // ?availability=OWNED,CAFE
  availability: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : undefined)),
  noPassword: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  includeFull: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).optional(),
});

// Guests may browse (FR-09), so these two routes do not require login.
partiesPublicRouter.get("/", async (req, res) => {
  const filters = parse(listQuery, req.query);
  res.json(await participation.listParties(filters));
});

partiesPublicRouter.get("/:id", async (req, res) => {
  res.json({ party: await participation.getPartyDetail(param(req, "id"), req.user) });
});

const joinBody = z.object({ password: z.string().optional() });

partiesPublicRouter.post("/:id/join", requireUser, async (req, res) => {
  const { password } = parse(joinBody, req.body ?? {});
  const result = await participation.joinParty(param(req, "id"), currentUser(req), password);
  res.json({ ...result, redirectTo: `/parties/${param(req, "id")}/chat` }); // FR-52
});

partiesPublicRouter.post("/:id/leave", requireUser, async (req, res) => {
  res.json(await participation.leaveParty(param(req, "id"), currentUser(req)));
});

partiesPublicRouter.put("/:id/bookmark", requireUser, notYet("Bookmarks (FR-74)"));
partiesPublicRouter.delete("/:id/bookmark", requireUser, notYet("Bookmarks (FR-75)"));

meRouter.get("/parties", requireUser, async (req, res) => {
  res.json(await participation.myParties(currentUser(req)));
});

meRouter.get("/bookmarks", requireUser, notYet("Bookmarks list (FR-76)"));
