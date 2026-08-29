import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { env } from "@/lib/env";

/**
 * Media storage abstraction. The application never talks to a concrete
 * storage vendor directly — swap drivers via MEDIA_STORAGE_DRIVER.
 *
 * - local: filesystem under .data/uploads (development / single server)
 * - s3:    any S3-compatible object store (AWS S3, Cloudflare R2, MinIO, Backblaze B2)
 */

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

interface S3ClientLike {
  send(cmd: unknown): Promise<unknown>;
}

class LocalDiskStorage implements StorageProvider {
  private root = path.join(process.cwd(), ".data", "uploads");

  private filePath(key: string): string {
    // Prevent path traversal: keys are generated server-side but validate anyway.
    const safe = key.replace(/\\/g, "/").split("/").filter((p) => p && p !== "." && p !== "..").join("/");
    return path.join(this.root, safe);
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const fp = this.filePath(key);
    await mkdir(path.dirname(fp), { recursive: true });
    await writeFile(fp, data);
    await writeFile(`${fp}.meta`, contentType, "utf8");
  }

  async get(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const fp = this.filePath(key);
      const data = await readFile(fp);
      let contentType = "application/octet-stream";
      try {
        contentType = (await readFile(`${fp}.meta`, "utf8")).trim() || contentType;
      } catch {
        /* meta missing — fall back */
      }
      return { data, contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.filePath(key));
    } catch {
      /* already gone */
    }
  }
}

class S3Storage implements StorageProvider {
  private clientPromise: Promise<S3ClientLike> | null = null;

  constructor() {
    if (!env.s3Bucket || !env.s3AccessKeyId || !env.s3SecretAccessKey) {
      throw new Error("S3 storage requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
    }
  }

  /**
   * Loads @aws-sdk/client-s3 at runtime (install it separately:
   * `npm i @aws-sdk/client-s3`). Kept out of the bundle so the app
   * runs without the dependency when the local driver is used.
   */
  private async client(): Promise<S3ClientLike> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const pkg = "@aws-sdk/client-s3";
        const mod = (await import(/* webpackIgnore: true */ pkg)) as typeof import("@aws-sdk/client-s3");
        const s3 = new mod.S3Client({
          region: env.s3Region,
          endpoint: env.s3Endpoint,
          forcePathStyle: Boolean(env.s3Endpoint),
          credentials: {
            accessKeyId: env.s3AccessKeyId!,
            secretAccessKey: env.s3SecretAccessKey!,
          },
        });
        return s3 as unknown as S3ClientLike;
      })();
    }
    return this.clientPromise;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const { PutObjectCommand } = await import(/* webpackIgnore: true */ "@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, Body: data, ContentType: contentType }));
  }

  async get(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const { GetObjectCommand } = await import(/* webpackIgnore: true */ "@aws-sdk/client-s3");
      const client = await this.client();
      const res = (await client.send(new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }))) as {
        Body: { transformToByteArray(): Promise<Uint8Array> };
        ContentType?: string;
      };
      const bytes = await res.Body.transformToByteArray();
      return { data: Buffer.from(bytes), contentType: res.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import(/* webpackIgnore: true */ "@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }));
  }
}

let provider: StorageProvider | null = null;

export function storage(): StorageProvider {
  if (!provider) {
    provider = env.storageDriver === "s3" ? new S3Storage() : new LocalDiskStorage();
  }
  return provider;
}

/** Generates a content-addressed-ish unique key. `folder` e.g. "posts", "avatars". */
export function buildMediaKey(folder: string, ext: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${folder}/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}
