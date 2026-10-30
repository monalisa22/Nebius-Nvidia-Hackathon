import OpenAI from "openai";
import { z } from "zod";
import { DomainError, isDomainError } from "../anubandh/store";

export function familyModelOptions(model: string) {
  // Nano's reasoning shares max_tokens with the function arguments.
  return /nemotron-3-nano/i.test(model)
    ? { chat_template_kwargs: { enable_thinking: false }, parallel_tool_calls: false }
    : { parallel_tool_calls: false };
}

export function readFamilyReport(response: OpenAI.ChatCompletion, name: string) {
  const choice = response.choices[0];
  const calls = choice?.message.tool_calls;
  if (choice?.finish_reason === "length") {
    throw new DomainError("Nemotron reached its response limit before completing the result. Try fewer memories or a shorter caption.");
  }
  if (choice?.message.refusal)
    throw new DomainError("Nemotron could not prepare this content. Review the selected memories.");
  if (calls?.length !== 1 || calls[0].type !== "function" || calls[0].function.name !== name)
    throw new DomainError("Nemotron did not return the requested result. Please retry once.");
  return JSON.parse(calls[0].function.arguments) as unknown;
}

export function familyAiError(error: unknown): DomainError {
  if (isDomainError(error)) return error;
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403)
      return new DomainError("Nebius access was denied. Check the server-side API key and model access.");
    if (error.status === 429)
      return new DomainError("Nebius request or credit limit reached. Check your quota before retrying.", 429);
    if (error instanceof OpenAI.APIConnectionError || (error.status ?? 0) >= 500)
      return new DomainError("Nebius is temporarily unavailable. Please try again later.", 503);
    return new DomainError("Nebius rejected the AI request. Check the configured model and request settings.");
  }
  if (error instanceof z.ZodError) {
    // Log only schema paths/codes, never private model output or provider bodies.
    console.warn("Family AI schema validation failed", error.issues.map(i => ({ path: i.path.join("."), code: i.code })));
    return new DomainError("Nemotron returned a result with missing or oversized fields. Try fewer memories or a shorter caption.");
  }
  if (error instanceof SyntaxError)
    return new DomainError("Nemotron returned an incomplete structured result. Please retry once.");
  return new DomainError("AI processing failed unexpectedly. Please try again later.");
}
