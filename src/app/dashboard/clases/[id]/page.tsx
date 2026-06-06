import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClassOverviewPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const cls = await classService(supabase).getById(id);
  if (!cls) notFound();

  const modules = await moduleRepo(supabase).listByClass(id);

  return (
    <div className="max-w-xl">
      <p className="text-eyebrow text-ink-mute mb-2">Clase</p>
      {cls.description && (
        <p className="text-body text-ink-soft mb-6">{cls.description}</p>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface rounded-[12px] border-subtle p-4">
          <p className="text-[28px] font-black text-ink leading-none">{modules.length}</p>
          <p className="text-caption text-ink-mute mt-1">Módulos</p>
        </div>
        <div className="bg-surface rounded-[12px] border-subtle p-4">
          <p className="text-[28px] font-black text-ink leading-none">
            {modules.filter((m) => m.is_published).length}
          </p>
          <p className="text-caption text-ink-mute mt-1">Publicados</p>
        </div>
        <div className="bg-surface rounded-[12px] border-subtle p-4">
          <p className="text-mono text-ink leading-none pt-1">/c/{cls.slug}</p>
          <p className="text-caption text-ink-mute mt-1">URL pública</p>
        </div>
      </div>

      {modules.length === 0 ? (
        <p className="text-body text-ink-soft">
          Usa el panel izquierdo para crear tu primer módulo.
        </p>
      ) : (
        <p className="text-body text-ink-soft">
          Selecciona un módulo en el panel izquierdo para editarlo.
        </p>
      )}
    </div>
  );
}
