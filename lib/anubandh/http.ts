import { z } from "zod";
import { DomainError, isDomainError } from "./store";

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && new URL(origin).host !== request.headers.get("host"))
  )
    throw new DomainError(
      "This request did not come from this application.",
      403,
    );
}
export async function jsonBody(request: Request) {
  checkOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new DomainError("Expected a JSON request.", 415);
  const text = await request.text();
  if (text.length > 40000)
    throw new DomainError("This request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("This request could not be read.");
  }
}
export function apiError(error: unknown) {
  if (error instanceof z.ZodError)
    return Response.json(
      { error: error.issues[0]?.message ?? "Please check the form." },
      { status: 400 },
    );
  if (isDomainError(error))
    return Response.json({ error: error.message }, { status: error.status });
  console.error("Anubandh request failed; private error details suppressed.");
  return Response.json(
    {
      error:
        "Something went wrong. Your saved information is safe; please try again.",
    },
    { status: 500 },
  );
}
export const text = z.string().trim().min(1).max(200);
export const optionalText = z.string().trim().max(4000).default("");
export const uuid = z.string().uuid();
export const future = z
  .number()
  .int()
  .refine((t) => t > Date.now(), "Choose a future date.");
