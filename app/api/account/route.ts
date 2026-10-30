import { z } from "zod";
import { currentMember, signIn, signOut } from "@/lib/anubandh/auth";
import { DomainError, getStore } from "@/lib/anubandh/store";
import { createDemo } from "@/lib/anubandh/demo";
import { apiError, jsonBody, text } from "@/lib/anubandh/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const action = z.string().parse(body.action);
    const store = getStore();
    if (action === "logout") {
      await signOut();
      return Response.json({ ok: true });
    }
    if (action === "demo") {
      store.throttle("demo-creation", 20, 3600000);
      const member = createDemo(store);
      await signIn(member.id);
      return Response.json({ ok: true });
    }
    if (action === "demo-person") {
      const member = await currentMember();
      if (!member || !store.family(member.family_id).is_demo)
        throw new DomainError(
          "Available only in an isolated sample family.",
          403,
        );
      const memberId = z.string().uuid().parse(body.memberId);
      if (!store.members(member).some((m) => m.id === memberId))
        throw new DomainError("Sample person not found.", 404);
      await signIn(store.member(memberId).id);
      return Response.json({ ok: true });
    }
    const credentials = z
      .object({
        email: z
          .string()
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        password: z
          .string()
          .min(12, "Use at least 12 characters for your password.")
          .max(128),
      })
      .parse(body);
    if (action === "login") {
      await signIn(store.login(credentials.email, credentials.password).id);
      return Response.json({ ok: true });
    }
    if (action === "register") {
      store.throttle("family-registration", 10, 3600000);
      const profile = z.object({ name: text, familyName: text }).parse(body);
      await signIn(store.createFamily({ ...profile, ...credentials }).id);
      return Response.json({ ok: true });
    }
    if (action === "join") {
      const token = z
        .string()
        .regex(/^[a-f0-9]{48}$/)
        .parse(body.token);
      store.throttle(`join:${token}`, 8);
      await signIn(
        store.join(token, credentials.email, credentials.password).id,
      );
      return Response.json({ ok: true });
    }
    throw new DomainError("Unknown account action.");
  } catch (error) {
    return apiError(error);
  }
}
