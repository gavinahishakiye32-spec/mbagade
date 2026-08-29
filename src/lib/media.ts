import { LIMITS, ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME, ALLOWED_DOC_MIME, ALLOWED_AUDIO_MIME } from "@/config/constants";
import { ApiError } from "@/lib/api";

export type MediaKind = "image" | "video" | "document" | "audio";

/** Magic-byte signatures for upload validation. Never trust the client MIME. */
function detectMime(buf: Uint8Array): string | null {
  const hex = (start: number, len: number) =>
    Array.from(buf.slice(start, start + len), (b) => b.toString(16).padStart(2, "0")).join("");
  const ascii = (start: number, len: number) => String.fromCharCode(...buf.slice(start, start + len));

  if (hex(0, 3) === "ffd8ff") return "image/jpeg";
  if (hex(0, 4) === "89504e47") return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (hex(0, 4) === "1a45dfa3") return "video/webm";
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    // Audio-only MP4 containers (M4A), else treat as video (isom, mp42, avc1, qt…)
    if (brand === "M4A " || brand === "m4a ") return "audio/mp4";
    if (brand.startsWith("qt")) return "video/quicktime";
    return "video/mp4";
  }
  if (ascii(0, 5) === "%PDF-") return "application/pdf";

  // Audio signatures
  if (ascii(0, 3) === "ID3") return "audio/mpeg"; // mp3 (tagged)
  if (hex(0, 2) === "fff3" || hex(0, 2) === "fff2") return "audio/mpeg"; // raw MPEG frames (rare)
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "audio/wav";
  if (ascii(0, 4) === "OggS") return "audio/ogg";
  if (ascii(0, 3) === "fLaC") return "audio/ogg"; // FLAC

  return null;
}

export interface ValidatedFile {
  kind: MediaKind;
  mime: string;
  ext: string;
  size: number;
  data: Buffer;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
};

export async function validateUpload(file: File, kindHint?: "audio" | "video" | "image" | "document"): Promise<ValidatedFile> {
  if (file.size === 0) throw new ApiError("EMPTY_FILE", "The uploaded file is empty", 422);
  if (file.size > LIMITS.videoMaxBytes)
    throw new ApiError("FILE_TOO_LARGE", `File too large. Maximum ${LIMITS.videoMaxBytes / (1024 * 1024)}MB`, 413);

  const head = Buffer.from(await file.slice(0, 32).arrayBuffer());
  const detected = detectMime(head);
  if (!detected) throw new ApiError("UNSUPPORTED_FILE_TYPE", "Unsupported or corrupted file", 415);

  let kind: MediaKind;
  let maxBytes: number;
  if (detected.startsWith("image/") && detected !== "application/pdf") {
    kind = "image";
    maxBytes = LIMITS.imageMaxBytes;
    if (!ALLOWED_IMAGE_MIME.includes(detected as (typeof ALLOWED_IMAGE_MIME)[number]))
      throw new ApiError("UNSUPPORTED_FILE_TYPE", "Image type not allowed", 415);
  } else if (detected.startsWith("video/")) {
    kind = "video";
    maxBytes = kindHint === "audio" ? LIMITS.soundMaxBytes : LIMITS.videoMaxBytes;
    if (!ALLOWED_VIDEO_MIME.includes(detected as (typeof ALLOWED_VIDEO_MIME)[number]))
      throw new ApiError("UNSUPPORTED_FILE_TYPE", "Video type not allowed", 415);
  } else if (detected.startsWith("audio/")) {
    kind = "audio";
    maxBytes = kindHint === "video" ? LIMITS.soundMaxBytes : LIMITS.soundMaxBytes;
    if (!ALLOWED_AUDIO_MIME.includes(detected as (typeof ALLOWED_AUDIO_MIME)[number]))
      throw new ApiError("UNSUPPORTED_FILE_TYPE", "Audio type not allowed", 415);
  } else {
    kind = "document";
    maxBytes = kindHint ? LIMITS.soundMaxBytes : LIMITS.docMaxBytes;
    if (!ALLOWED_DOC_MIME.includes(detected as (typeof ALLOWED_DOC_MIME)[number]))
      throw new ApiError("UNSUPPORTED_FILE_TYPE", "Document type not allowed", 415);
  }

  if (file.size > maxBytes)
    throw new ApiError("FILE_TOO_LARGE", `File too large. Maximum ${maxBytes / (1024 * 1024)}MB`, 413);

  const full = Buffer.from(await file.arrayBuffer());
  return { kind, mime: detected, ext: EXT_BY_MIME[detected] ?? "bin", size: full.length, data: full };
}
