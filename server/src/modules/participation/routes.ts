// GET /api/parties, GET /api/parties/:id, join/leave, /api/me/parties  OWNER: C
import { param } from "../../lib/params";
import { Router } from "express";
import { z } from "zod";
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
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  minSeats: z.coerce.number().int().min(0).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxDistanceKm: z.coerce.number().positive().optional(),
  sort: z.enum(["soonest", "seats", "distance"]).optional(),
}).refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, {
  message: "dateFrom must be before dateTo",
}).refine((v) => v.maxDistanceKm === undefined || (v.lat !== undefined && v.lng !== undefined), {
  message: "Distance filtering requires lat and lng",
}).refine((v) => v.sort !== "distance" || (v.lat !== undefined && v.lng !== undefined), {
  message: "Distance sorting requires lat and lng",
});

// Guests may browse (FR-09), so these two routes do not require login.
partiesPublicRouter.get("/", async (req, res) => {
  const filters = parse(listQuery, req.query);
  res.json(await participation.listParties({ ...filters, viewerId: req.user?.id }));
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

partiesPublicRouter.put("/:id/bookmark", requireUser, async (req, res) => {
  res.json(await participation.addBookmark(param(req, "id"), currentUser(req).id));
});
partiesPublicRouter.delete("/:id/bookmark", requireUser, async (req, res) => {
  res.json(await participation.removeBookmark(param(req, "id"), currentUser(req).id));
});
partiesPublicRouter.put("/:id/hide", requireUser, async (req, res) => {
  res.json(await participation.hideParty(param(req, "id"), currentUser(req).id));
});
partiesPublicRouter.delete("/:id/hide", requireUser, async (req, res) => {
  res.json(await participation.unhideParty(param(req, "id"), currentUser(req).id));
});

meRouter.get("/parties", requireUser, async (req, res) => {
  res.json(await participation.myParties(currentUser(req)));
});

meRouter.get("/bookmarks", requireUser, async (req, res) => {
  res.json(await participation.listBookmarks(currentUser(req).id));
});
