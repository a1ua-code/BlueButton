// Public video metadata: guests can read; admin actions are mounted behind requireAdmin.
import { Router } from "express";
import { z } from "zod";
import { param } from "../../lib/params";
import { parse } from "../../lib/validate";
import * as videos from "./service";

export const partyVideosRouter = Router();
export const gameVideosRouter = Router();
export const adminVideosRouter = Router();

partyVideosRouter.get("/:id/videos", async (req, res) => {
  res.json(await videos.videosForParty(parse(z.uuid(), param(req, "id"))));
});

gameVideosRouter.get("/:id/videos", async (req, res) => {
  res.json(await videos.videosForCatalogGame(parse(z.uuid(), param(req, "id"))));
});

adminVideosRouter.get("/games/:gameId", async (req, res) => {
  res.json(await videos.adminListVideos(parse(z.uuid(), param(req, "gameId"))));
});

const moderateSchema = z.object({
  status: z.enum(["AUTO", "APPROVED", "HIDDEN"]).optional(),
  pinned: z.boolean().optional(),
}).strict().refine(v => v.status !== undefined || v.pinned !== undefined, "Supply status or pinned.");

adminVideosRouter.patch("/:id", async (req, res) => {
  res.json({ video: await videos.adminModerateVideo(
    parse(z.uuid(), param(req, "id")), parse(moderateSchema, req.body),
  ) });
});

adminVideosRouter.post("/:id/replace", async (req, res) => {
  const body = parse(z.object({ youtubeId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/) }).strict(), req.body);
  res.json({ video: await videos.adminReplaceVideo(parse(z.uuid(), param(req, "id")), body.youtubeId) });
});
