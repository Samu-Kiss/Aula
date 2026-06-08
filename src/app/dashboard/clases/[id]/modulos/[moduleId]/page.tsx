import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { CreateContentForm } from "./CreateContentForm";
import { ContentList } from "./ContentList";
import { PublishModuleToggle } from "./PublishModuleToggle";
import { ModuleAvailabilityForm } from "./ModuleAvailabilityForm";

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

      <ContentList
        classId={classId}
        moduleId={moduleId}
        initialContents={contents}
      />

      <CreateContentForm moduleId={moduleId} classId={classId} />

      {/* F4-01: Availability window controls */}
      <div className="mt-8">
        <ModuleAvailabilityForm module={modData as import("@/lib/types/db").Module} classId={classId} />
      </div>
    </div>
  );
}
