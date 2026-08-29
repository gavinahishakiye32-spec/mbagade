/**
 * Minimal ambient types for @aws-sdk/client-s3.
 * The package is loaded at runtime only when MEDIA_STORAGE_DRIVER=s3
 * (install it then: `npm i @aws-sdk/client-s3`). These declarations keep
 * the codebase fully typed without adding the dependency weight for the
 * default local driver.
 */
declare module "@aws-sdk/client-s3" {
  export interface S3ClientConfig {
    region?: string;
    endpoint?: string;
    forcePathStyle?: boolean;
    credentials?: { accessKeyId: string; secretAccessKey: string };
  }
  export class S3Client {
    constructor(config?: S3ClientConfig);
    send(command: unknown): Promise<unknown>;
  }
  export class PutObjectCommand {
    constructor(input: Record<string, unknown>);
  }
  export class GetObjectCommand {
    constructor(input: Record<string, unknown>);
  }
  export class DeleteObjectCommand {
    constructor(input: Record<string, unknown>);
  }
}
