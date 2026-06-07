import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { quizRepo } from "@/server/repositories/quizRepo";
import { TiptapEditor } from "./TiptapEditor";
import { QuizEditor } from "./QuizEditor";

interface Props {
  params: Promise<{ id: string; moduleId: string; contentId: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  rich_text: "Lectura",
  video: "Video",
  quiz: "Evaluación",
  file: "Archivo",
  map: "Mapa",
};

export default async function ContentEditorPage({ params }: Props) {
  const { id: classId, contentId } = await params;
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .single();

  if (!content) notFound();

  let initialQuiz = null;
  let initialQuestions: unknown[] = [];

  if (content.type === "quiz") {
    const repo = quizRepo(supabase);
    initialQuiz = await repo.findByContentId(contentId);
    if (initialQuiz) {
      initialQuestions = await repo.listQuestions(initialQuiz.id);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <p className="text-eyebrow text-ink-mute mb-1">
          {TYPE_LABELS[content.type] ?? content.type}
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
      ) : content.type === "quiz" ? (
        <QuizEditor
          contentId={contentId}
          classId={classId}
          initialQuiz={initialQuiz}
          initialQuestions={initialQuestions as import("@/lib/types/db").QuizQuestion[]}
          isPublished={content.is_published}
        />
      ) : (
        <div className="bg-surface rounded-[12px] border border-subtle p-8 text-center">
          <p className="text-body text-ink-soft">
            El editor para este tipo de contenido llega en una próxima fase.
          </p>
        </div>
      )}
    </div>
  );
}
