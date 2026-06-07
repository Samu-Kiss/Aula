import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { gradeRepo } from "@/server/repositories/gradeRepo";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { quizRepo } from "@/server/repositories/quizRepo";
import { CategoriasClient } from "./CategoriasClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CategoriasPage({ params }: Props) {
  const { id: classId } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getById(classId);
  if (!cls) notFound();

  const svc = createServiceClient();
  const repo = gradeRepo(svc);

  const [categories, items] = await Promise.all([
    repo.listCategories(classId),
    repo.listItems(classId),
  ]);

  // Build quiz options for the dropdown
  const modules = await moduleRepo(supabase).listByClass(classId);
  const quizOptions: { id: string; title: string; moduleName: string }[] = [];
  for (const mod of modules) {
    const contents = await contentRepo(supabase).listByModule(mod.id);
    for (const c of contents.filter((c) => c.type === "quiz")) {
      const quiz = await quizRepo(svc).findByContentId(c.id);
      if (!quiz) continue;
      quizOptions.push({ id: quiz.id, title: c.title, moduleName: mod.title });
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-eyebrow text-ink-mute mb-1">Calificaciones</p>
          <h1 className="text-h2 text-ink">Categorías y pesos</h1>
          <p className="text-body text-ink-soft mt-1">
            Define cómo se distribuye la nota final. El total debe sumar 100%.
          </p>
        </div>
      </div>

      <CategoriasClient
        classId={classId}
        initialCategories={categories}
        initialItems={items}
        quizOptions={quizOptions}
      />
    </div>
  );
}
