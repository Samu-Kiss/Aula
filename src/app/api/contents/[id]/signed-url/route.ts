import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStudentAccess } from "@/lib/auth/studentAccess";
import { presignDownload } from "@/lib/r2";

// GET /api/contents/[id]/signed-url — signed download URL for file content.
// Access control:
//   - The professor who owns the class can download the draft file.
//   - A student with an approved enrollment in that class can download the
//     published file (only if the content is published).
// Anyone else (no session, unenrolled/pending/inactive student, or a professor
// who does not own the class) is rejected — the private R2 object must never be
// reachable by simply knowing a content id.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contentId } = await params;

  // Service client bypasses RLS; we enforce authorization explicitly below.
  const svc = createServiceClient();

  const { data: content } = await svc
    .from("contents")
    .select("type, is_published, body_published, body_draft, module_id")
    .eq("id", contentId)
    .maybeSingle();

  if (!content || content.type !== "file" || !content.module_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Resolve the owning class so we can check the caller's relationship to it.
  const { data: moduleRow } = await svc
    .from("modules")
    .select("class_id")
    .eq("id", content.module_id)
    .maybeSingle();

  if (!moduleRow?.class_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const access = await getStudentAccess(moduleRow.class_id);

  // `student === null` with state "approved" means the caller is the class's
  // professor (Supabase session). A non-null student means an identified student.
  const isOwnerProfessor = access.state === "approved" && access.student === null;
  const isApprovedStudent = access.state === "approved" && access.student !== null;

  if (!isOwnerProfessor && !isApprovedStudent) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // The owning professor may reach the draft; students only the published copy,
  // and only once the content is actually published.
  let body: Record<string, unknown> | null;
  if (isOwnerProfessor) {
    body = (content.body_draft ?? content.body_published) as Record<string, unknown> | null;
  } else {
    if (!content.is_published) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    body = content.body_published as Record<string, unknown> | null;
  }

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
