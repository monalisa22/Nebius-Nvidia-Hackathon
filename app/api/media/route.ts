import { requireMember } from "@/lib/anubandh/auth";
import { apiError, checkOrigin } from "@/lib/anubandh/http";
import { uploadMedia } from "@/lib/anubandh/media";
import { DomainError } from "@/lib/anubandh/store";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const member = await requireMember();
    if (Number(request.headers.get("content-length")) > 9 * 1024 * 1024)
      throw new DomainError("Maximum upload size is 8 MB.", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new DomainError("Choose a photo or recording.");
    return Response.json(await uploadMedia(member, file));
  } catch (error) {
    return apiError(error);
  }
}
