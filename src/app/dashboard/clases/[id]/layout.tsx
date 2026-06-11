import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { ModuleSidebar } from "@/components/dashboard/ModuleSidebar";
import { ClassHeaderCrumbs } from "@/components/dashboard/ClassHeaderCrumbs";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getById(id);
  if (!cls) return {};
  return { title: { default: cls.title, template: `%s · ${cls.title}` } };
}

export default async function ClassEditorLayout({ children, params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const cls = await classService(supabase).getById(id);
  if (!cls) notFound();

  const modules = await moduleRepo(supabase).listByClass(id);

  return (
    <div className="flex flex-1 min-h-0 -mx-4 -my-6 md:-mx-8 md:-my-8 max-md:flex-col">
      {/* Título de la clase + breadcrumbs, inyectados en el header del dashboard */}
      <ClassHeaderCrumbs
        classId={id}
        title={cls.title}
        accent={cls.accent}
        splitAt={cls.lockup_split_at}
        isPublished={cls.is_published}
        moduleTitles={Object.fromEntries(modules.map((m) => [m.id, m.title]))}
      />

      {/* Module sidebar */}
      <ModuleSidebar classId={id} initialModules={modules} />

      {/* Page content */}
      <div className="flex-1 min-w-0 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        {children}
      </div>
    </div>
  );
}
