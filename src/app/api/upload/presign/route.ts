import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presignUpload } from "@/lib/r2";
import { z } from "zod";

const ALLOWED_FILE_TYPES = [
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
];

const schema = z.object({
  key: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
  bucket: z.enum(["public", "private"]).default("private"),
});

// POST /api/upload/presign — generate presigned upload URL (professor only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { key, contentType, bucket } = parsed.data;

  // Images can go to public bucket; other files must use private
  const isImage = contentType.startsWith("image/");
  if (bucket === "public" && !isImage) {
    return NextResponse.json({ error: "only_images_in_public_bucket" }, { status: 400 });
  }

  if (!ALLOWED_FILE_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "unsupported_content_type" }, { status: 400 });
  }

  try {
    const url = await presignUpload(key, contentType, bucket);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("R2 presign error:", err);
    return NextResponse.json({ error: "r2_not_configured" }, { status: 503 });
  }
}
