import { requireMember } from "@/lib/anubandh/auth";
import { apiError } from "@/lib/anubandh/http";
import { readMedia } from "@/lib/anubandh/media";

export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const member = await requireMember();
    const { id } = await params;
    const { bytes, mime } = readMedia(member, id);
    const headers: Record<string, string> = {
      "Content-Type": mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
      "Content-Disposition": "inline",
    };
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${bytes.length}` },
        });
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, bytes.length - Number(match[2]));
      const end = match[1]
        ? match[2]
          ? Math.min(Number(match[2]), bytes.length - 1)
          : bytes.length - 1
        : bytes.length - 1;
      if (start >= bytes.length || start > end)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${bytes.length}` },
        });
      return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
    return new Response(new Uint8Array(bytes), {
      headers: { ...headers, "Content-Length": String(bytes.length) },
    });
  } catch (error) {
    return apiError(error);
  }
}
