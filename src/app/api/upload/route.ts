import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { putObject, R2_PUBLIC_URL } from "@/lib/r2";

// Allow large file uploads (up to 50 MB)
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ALLOWED_TYPES: Record<string, string[]> = {
  private: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "video/mp4",
    "audio/mpeg",
    "audio/wav",
    "application/zip",
  ],
  public: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
};

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// POST /api/upload — server-side upload to R2 (professor only)
// Accepts multipart/form-data: file, prefix (path prefix), bucket ("public"|"private")
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const prefix = (formData.get("prefix") as string | null) ?? "";
  const bucket = ((formData.get("bucket") as string | null) ?? "private") as "public" | "private";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (bucket !== "public" && bucket !== "private") {
    return NextResponse.json({ error: "invalid_bucket" }, { status: 400 });
  }

  const contentType = file.type || "application/octet-stream";
  const allowed = ALLOWED_TYPES[bucket] ?? ALLOWED_TYPES.private;
  if (!allowed.includes(contentType)) {
    return NextResponse.json({ error: "unsupported_content_type", contentType }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "file_too_large", max_mb: 50 }, { status: 413 });
  }

  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${prefix}${Date.now()}-${safeFilename}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject(key, buffer, contentType, bucket);

    const url = bucket === "public" && R2_PUBLIC_URL()
      ? `${R2_PUBLIC_URL()}/${key}`
      : null;

    return NextResponse.json({ key, url, file_name: file.name, file_type: contentType, file_size: file.size });
  } catch (err) {
    console.error("R2 upload error:", err);
    return NextResponse.json({ error: "r2_upload_failed", detail: String(err) }, { status: 503 });
  }
}
