import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * GET /api/media/[...key] — serves stored media with caching and
 * HTTP Range support (required for video seeking).
 */
export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const storageKey = key.join("/");
  const file = await storage().get(storageKey);
  if (!file) return new Response("Not found", { status: 404 });

  const total = file.data.length;
  const range = req.headers.get("range");

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
      if (start <= end && start < total) {
        const chunk = file.data.subarray(start, end + 1);
        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "Content-Type": file.contentType,
            "Content-Length": String(chunk.length),
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
  }

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
