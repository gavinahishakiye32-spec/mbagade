import { handle, ok, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { validateUpload, type ValidatedFile } from "@/lib/media";
import { storage, buildMediaKey } from "@/lib/storage";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

export const runtime = "nodejs";

/**
 * POST /api/media/upload — multipart/form-data with field "file".
 * Validates magic bytes + size server-side (never trusts client MIME),
 * stores via the storage abstraction, returns the media key.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  enforceRateLimit(req, "upload", 30, 60 * 60 * 1000, String(user._id));
  await connectDB();

  const form = await req.formData().catch(() => null);
  if (!form) throw new ApiError("INVALID_INPUT", "Expected multipart/form-data", 400);
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("INVALID_INPUT", "Missing file field", 422);

  const folder = typeof form.get("folder") === "string" ? String(form.get("folder")) : "misc";
  const safeFolder = ["posts", "avatars", "logos", "covers", "products", "verification", "messages", "thumbnails", "sounds"].includes(folder)
    ? folder
    : "misc";

  const hint = safeFolder === "sounds" ? ("audio" as const) : undefined;
  const validated: ValidatedFile = await validateUpload(file, hint);
  const key = buildMediaKey(safeFolder, validated.ext);
  await storage().put(key, validated.data, validated.mime);

  return ok({
    key,
    url: `/api/media/${key}`,
    kind: validated.kind,
    mime: validated.mime,
    size: validated.size,
  });
});
