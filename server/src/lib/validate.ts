// Validates request input with a zod schema. On failure it throws a 400 error whose
// `fields` map each bad field to a message, so the form can show it beside the input (IR-21).
//
//   const body = parse(createPartySchema, req.body);
//
// zod docs: https://zod.dev
import type { z } from "zod";
import { badRequest } from "./errors";

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  throw badRequest("Please fix the highlighted fields.", fields);
}
