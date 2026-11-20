// Turns thrown errors into JSON responses. Registered last in app.ts.
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, fields: err.fields },
    });
    return;
  }

  // Invalid JSON in the request body
  if (err instanceof SyntaxError && "body" in err) {
    res
      .status(400)
      .json({ error: { code: "BAD_JSON", message: "Request body is not valid JSON." } });
    return;
  }

  console.error("[unexpected error]", err);
  res
    .status(500)
    .json({ error: { code: "INTERNAL", message: "Something went wrong on the server." } });
}
