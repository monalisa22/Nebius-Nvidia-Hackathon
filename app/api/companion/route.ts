import { z } from "zod";
import { requireMember } from "@/lib/anubandh/auth";
import { apiError, jsonBody } from "@/lib/anubandh/http";
import { getStore } from "@/lib/anubandh/store";
import { CompanionService } from "@/lib/togetherly/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const member = await requireMember();
    const service = new CompanionService(getStore());
    const personId = new URL(request.url).searchParams.get("personId");
    return Response.json(personId ? service.callContext(member, z.string().uuid().parse(personId)) : service.snapshot(member),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const member = await requireMember();
    return Response.json(new CompanionService(getStore()).command(member, body),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
