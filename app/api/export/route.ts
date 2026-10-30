import { requireMember } from "@/lib/anubandh/auth";
import { apiError } from "@/lib/anubandh/http";
import { getStore } from "@/lib/anubandh/store";
import { CompanionService } from "@/lib/togetherly/service";

export async function GET() {
  try {
    const member = await requireMember();
    const data = getStore().snapshot(member);
    return new Response(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          family: data.family.name,
          people: data.people,
          memories: data.memories,
          messages: data.messages,
          companion: new CompanionService(getStore()).snapshot(member),
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=togetherly-memories.json",
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
