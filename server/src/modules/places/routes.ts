// Cafe discovery endpoint (B). POST keeps precise device coordinates out of URL logs.
import { Router } from "express";
import { z } from "zod";
import { parse } from "../../lib/validate";
import { searchBoardGameCafes } from "./service";

export const placesRouter = Router();

const locationSchema = z.union([
  z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }).strict(),
  z.object({ address: z.string().trim().min(2).max(120) }).strict(),
]);

// Public route: guests may browse cafes without creating an account.
placesRouter.post("/search", async (req, res) => {
  const location = parse(locationSchema, req.body);
  res.json(await searchBoardGameCafes(location));
});
