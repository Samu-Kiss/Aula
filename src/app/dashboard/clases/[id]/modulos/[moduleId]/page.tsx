import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { CreateContentForm } from "./CreateContentForm";
import { PublishModuleToggle } from "./PublishModuleToggle";

interface Props {
  params: Promise<{ id: string; moduleId: string }>;
}

const CONTENT_LABELS: Record<string, string> = {
  rich_text: "Lectura",
  video: "Video",
  map: "Mapa",
  file: "Archivo",
  quiz: "Evaluación",
};

export default async function ModuleEditorPage({ params }: Props) {
  const { id: classId, moduleId } = await params;
  const supabase = await createClient();

  const mod = await moduleRepo(supabase).findBySlug(classId, moduleId).catch(() => null);
  // findBySlug uses slug, but here we have the ID — fetch by ID instead
  const { data: modData } = await supabase
    .from("modules")
    .select("*")
    .eq("id", moduleId)
    .single();
  if (!modData) notFound();

  const contents = await contentRepo(supabase).listByModule(moduleId);

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-eyebrow text-ink-mute mb-1">Módulo</p>
          <h1 className="text-h1 text-ink">{modData.title}</h1>
          {modData.description && (
            <p className="text-body text-ink-soft mt-1">{modData.description}</p>
          )}
        </div>
        <PublishModuleToggle
          moduleId={moduleId}
          classId={classId}
          isPublished={modData.is_published}
        />
      </div>

      {contents.length === 0 ? (
        <p className="text-body text-ink-soft mb-6">No hay contenidos todavía.</p>
      ) : (
        <ol className="space-y-2 mb-6">
          {contents.map((content, i) => (
            <li key={content.id}>
              <Link
                href={`/dashboard/clases/${classId}/modulos/${moduleId}/contenidos/${content.id}`}
                className="flex items-center gap-4 px-4 py-3 rounded-[12px] bg-surface border-subtle hover:border-ink/20 transition-colors group"
              >
                <span className="text-mono text-ink-mute w-6 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-body text-ink">{content.title}</span>
                <span className="text-mono text-ink-mute text-xs">
                  {CONTENT_LABELS[content.type] ?? content.type}
                </span>
                <span className={`text-mono text-xs px-1.5 py-0.5 rounded-[4px] ${
                  content.is_published
                    ? "bg-bosque/10 text-bosque"
                    : "bg-surface-alt text-ink-mute"
                }`}>
                  {content.is_published ? "✓" : "Borrador"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <CreateContentForm moduleId={moduleId} classId={classId} />
    </div>
  );
}
