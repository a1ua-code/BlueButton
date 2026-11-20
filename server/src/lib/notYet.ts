// Placeholder handler for routes that are planned but not built yet. Returns 501.
//   router.patch("/:id", requireUser, notYet("Editing a party (FR-61)"));
// Replace it with a real handler when you build the feature.
import type { Request, Response } from "express";

export const notYet = (feature: string) => (_req: Request, res: Response) => {
  res
    .status(501)
    .json({ error: { code: "NOT_IMPLEMENTED", message: `${feature} is not built yet.` } });
};
