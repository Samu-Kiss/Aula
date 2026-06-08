import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";
import { presignDownload } from "@/lib/r2";

// GET /api/contents/[id]/signed-url — signed download URL for file content
// Professors can access draft; students can only access published
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contentId } = await params;

  const supabase = await createClient();
  const [{ data: { user } }, student] = await Promise.all([
    supabase.auth.getUser(),
    getStudentFromCookie(),
  ]);

  if (!user && !student) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: content } = await supabase
    .from("contents")
    .select("body_published, body_draft, is_published, type")
    .eq("id", contentId)
    .single();

  if (!content || content.type !== "file") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Students can only access published content
  const body = (student
    ? content.body_published
    : content.body_draft) as Record<string, unknown> | null;

  if (!body?.file_key) {
    return NextResponse.json({ error: "no_file" }, { status: 404 });
  }

  try {
    const url = await presignDownload(body.file_key as string);
    return NextResponse.json({
      url,
      file_name: body.file_name,
      file_type: body.file_type,
      file_size: body.file_size,
    });
  } catch (err) {
    console.error("R2 presign error:", err);
    return NextResponse.json({ error: "r2_not_configured" }, { status: 503 });
  }
}
