import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  bucket: "public" | "private" = "private"
): Promise<void> {
  const Bucket = bucket === "public" ? R2_PUBLIC_BUCKET() : R2_PRIVATE_BUCKET();
  await r2Client().send(
    new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType, ContentLength: body.length })
  );
}

export const R2_PUBLIC_BUCKET = () => process.env.R2_BUCKET_PUBLIC ?? "aula-public";
export const R2_PRIVATE_BUCKET = () => process.env.R2_BUCKET_PRIVATE ?? "aula-private";
export const R2_PUBLIC_URL = () => process.env.R2_PUBLIC_URL ?? "";

export async function presignUpload(
  key: string,
  contentType: string,
  bucket: "public" | "private" = "private",
  expiresIn = 300
): Promise<string> {
  const Bucket = bucket === "public" ? R2_PUBLIC_BUCKET() : R2_PRIVATE_BUCKET();
  const command = new PutObjectCommand({ Bucket, Key: key, ContentType: contentType });
  return getSignedUrl(r2Client(), command, { expiresIn });
}

export async function presignDownload(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: R2_PRIVATE_BUCKET(), Key: key });
  return getSignedUrl(r2Client(), command, { expiresIn });
}

export function publicUrl(key: string): string {
  return `${R2_PUBLIC_URL()}/${key}`;
}

export async function deleteObject(key: string, bucket: "public" | "private" = "private"): Promise<void> {
  const Bucket = bucket === "public" ? R2_PUBLIC_BUCKET() : R2_PRIVATE_BUCKET();
  await r2Client().send(new DeleteObjectCommand({ Bucket, Key: key }));
}

export async function deleteObjects(keys: { key: string; bucket: "public" | "private" }[]): Promise<void> {
  await Promise.all(keys.map(({ key, bucket }) => deleteObject(key, bucket)));
}

// Extracts R2 object keys from a Tiptap doc body by scanning image nodes
export function extractR2ImageKeys(body: unknown, r2PublicUrl: string): string[] {
  if (!r2PublicUrl) return [];
  const keys: string[] = [];
  const prefix = r2PublicUrl.endsWith("/") ? r2PublicUrl : r2PublicUrl + "/";
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "image" && n.attrs) {
      const src = (n.attrs as Record<string, unknown>).src as string | undefined;
      if (src?.startsWith(prefix)) keys.push(src.slice(prefix.length));
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  }
  // body is either { doc: { type:"doc", ... } } or a raw tiptap doc
  const doc = (body as Record<string, unknown>)?.doc ?? body;
  walk(doc);
  return keys;
}
