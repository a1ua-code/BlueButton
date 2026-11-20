// Builds the Express app: middleware first, then each module's routes, then error handling.
// To add a module: create src/modules/<name>/routes.ts and mount its router here.
import { existsSync } from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import { notFound } from "./lib/errors";
import { loadUser, requireAdmin } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { adminRouter } from "./modules/admin/routes";
import { authRouter } from "./modules/auth/routes";
import { chatRouter } from "./modules/chat/routes";
import { gamesRouter, partiesHostRouter } from "./modules/parties/routes";
import { meRouter, partiesPublicRouter } from "./modules/participation/routes";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(loadUser); // sets req.user when a valid session cookie is present

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter); //                A
  app.use("/api/admin", requireAdmin, adminRouter); // A
  app.use("/api/games", gamesRouter); //              B
  app.use("/api/parties", partiesHostRouter); //      B  create / status / cancel
  app.use("/api/parties", partiesPublicRouter); //    C  list / detail / join / leave
  app.use("/api/parties", chatRouter); //             D  messages
  app.use("/api/me", meRouter); //                    C  my parties

  app.use("/api", () => {
    throw notFound("API route");
  });

  // In production, the server also serves the built React app (client/dist).
  const clientDist = path.resolve(import.meta.dirname, "../../client/dist");
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
