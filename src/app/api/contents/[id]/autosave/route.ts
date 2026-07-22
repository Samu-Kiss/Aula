import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contentRepo } from "@/server/repositories/contentRepo";
import { autosaveContentSchema } from "@/lib/schemas/content";
import { extractR2ImageKeys, deleteObjects } from "@/lib/r2";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verificar propiedad ANTES de tocar nada. La política RLS de lectura pública
  // devuelve también contenidos publicados de otros profesores, así que sin este
  // check un profesor podría pasar el id de un contenido ajeno y disparar el
  // borrado de sus imágenes en R2 (deleteObjects más abajo), aunque el UPDATE lo
  // bloquee RLS. Comprobamos que el contenido pertenezca a una clase suya.
  const { data: contentOwn } = await supabase
    .from("contents")
    .select("module_id")
    .eq("id", id)
    .maybeSingle();
  const { data: moduleOwn } = contentOwn?.module_id
    ? await supabase.from("modules").select("class_id").eq("id", contentOwn.module_id).maybeSingle()
    : { data: null };
  const { data: classOwn } = moduleOwn?.class_id
    ? await supabase.from("classes").select("professor_id").eq("id", moduleOwn.class_id).maybeSingle()
    : { data: null };
  if (classOwn?.professor_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = autosaveContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const newDraft = parsed.data.body_draft;

  // For rich_text: detect removed R2 images and delete them from storage
  const r2Url = process.env.R2_PUBLIC_URL ?? "";
  if (r2Url && newDraft?.doc !== undefined) {
    try {
      const { data: current } = await supabase
        .from("contents")
        .select("body_draft")
        .eq("id", id)
        .single();

      if (current?.body_draft) {
        const oldKeys = new Set(extractR2ImageKeys(current.body_draft, r2Url));
        const newKeys = new Set(extractR2ImageKeys(newDraft, r2Url));
        const removed = [...oldKeys].filter((k) => !newKeys.has(k));
        if (removed.length > 0) {
          // Fire-and-forget — don't block the autosave response
          deleteObjects(removed.map((key) => ({ key, bucket: "public" as const }))).catch(
            (err) => console.error("R2 image cleanup error:", err)
          );
        }
      }
    } catch (err) {
      console.error("R2 image cleanup check error:", err);
    }
  }

  await contentRepo(supabase).autosave(id, newDraft);
  return NextResponse.json({ ok: true });
}
