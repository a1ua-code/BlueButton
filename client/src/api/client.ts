// The one function for talking to the server. Every API call goes through `api()`.
//
//   const data = await api<{ parties: PartySummary[] }>("/parties?q=catan");
//   await api("/parties/123/join", { method: "POST", body: { password } });
//
// Errors from the server become an ApiError with .code, .message and .fields
// (fields = per-input messages to show next to form fields).

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown };

export async function api<T = unknown>(
  path: string,
  { method = "GET", body }: Options = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "include", // send the login cookie
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the server. Is it running?");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(
      res.status,
      e.code ?? "UNKNOWN",
      e.message ?? "Something went wrong.",
      e.fields,
    );
  }
  return data as T;
}

/** Turns an unknown error into a message you can show the user. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

/** Field errors from a failed form submit ({} if none). */
export function fieldErrors(err: unknown): Record<string, string> {
  return err instanceof ApiError ? err.fields : {};
}
