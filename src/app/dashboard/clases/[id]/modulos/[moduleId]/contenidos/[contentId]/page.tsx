import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TiptapEditor } from "./TiptapEditor";

interface Props {
  params: Promise<{ id: string; moduleId: string; contentId: string }>;
}

export default async function ContentEditorPage({ params }: Props) {
  const { id: classId, contentId } = await params;
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .single();

  if (!content) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <p className="text-eyebrow text-ink-mute mb-1">
          {content.type === "rich_text" ? "Lectura" :
           content.type === "video" ? "Video" :
           content.type === "quiz" ? "Evaluación" :
           content.type === "file" ? "Archivo" : "Mapa"}
        </p>
        <h1 className="text-h1 text-ink">{content.title}</h1>
      </div>

      {content.type === "rich_text" ? (
        <TiptapEditor
          contentId={contentId}
          classId={classId}
          initialDraft={content.body_draft ?? {}}
          isPublished={content.is_published}
        />
      ) : (
        <div className="bg-surface rounded-[12px] border-subtle p-8 text-center">
          <p className="text-body text-ink-soft">
            El editor para este tipo de contenido llega en una próxima fase.
          </p>
        </div>
      )}
    </div>
  );
}
