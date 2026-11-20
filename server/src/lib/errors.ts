// Throw these from any route or service. The error handler (middleware/error.ts) turns
// them into a JSON response that the React app understands:
//
//   { "error": { "code": "PARTY_FULL", "message": "This party is already full.", "fields": {...} } }
//
// `fields` is for form errors: { title: "Must be 1-12 characters" } shows next to the input.

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(400, "BAD_REQUEST", message, fields);

export const unauthorized = (message = "Please log in first.") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "You are not allowed to do this.") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (what = "Item") => new AppError(404, "NOT_FOUND", `${what} not found.`);

export const conflict = (code: string, message: string) => new AppError(409, code, message);
