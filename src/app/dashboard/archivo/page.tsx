import { createClient } from "@/lib/supabase/server";
import { classRepo } from "@/server/repositories/classRepo";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { Lockup } from "@/components/Lockup";
import { ArchivedItemActions } from "./ArchivedItem";
import {
  restoreClassAction,
  permanentDeleteClassAction,
  restoreModuleAction,
  permanentDeleteModuleAction,
} from "./actions";
import type { Class, Module } from "@/lib/types/db";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months === 1) return "hace 1 mes";
  return `hace ${months} meses`;
}

function DeletedClassRow({ cls, classMap }: { cls: Class; classMap?: Map<string, Class> }) {
  void classMap; // not used here, just for signature consistency
  return (
    <div className="flex items-center gap-4 py-4 border-b border-subtle last:border-0">
      <div className="flex-1 min-w-0">
        <Lockup title={cls.title} accent={cls.accent} className="text-[22px]" />
        <p className="text-mono text-ink-mute mt-1">
          /c/{cls.slug} · eliminada {timeAgo(cls.deleted_at!)}
        </p>
      </div>
      <ArchivedItemActions
        onRestore={() => restoreClassAction(cls.id)}
        onPermanentDelete={() => permanentDeleteClassAction(cls.id)}
      />
    </div>
  );
}

function DeletedModuleRow({ mod, classMap }: { mod: Module; classMap: Map<string, Class> }) {
  const cls = classMap.get(mod.class_id);
  return (
    <div className="flex items-center gap-4 py-4 border-b border-subtle last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-body text-ink font-medium truncate">{mod.title}</p>
        <p className="text-mono text-ink-mute mt-0.5">
          {cls ? (
            <>en <span className="text-ink">{cls.title}</span> · </>
          ) : null}
          eliminado {timeAgo(mod.deleted_at!)}
        </p>
      </div>
      <ArchivedItemActions
        onRestore={() => restoreModuleAction(mod.id)}
        onPermanentDelete={() => permanentDeleteModuleAction(mod.id)}
      />
    </div>
  );
}

export const metadata = { title: "Archivo" };

export default async function ArchivoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch deleted classes
  const deletedClasses = await classRepo(supabase).listDeleted(user.id);

  // Fetch deleted modules — only from active classes (not already-deleted ones)
  const activeClasses = await classRepo(supabase).listByProfessor(user.id);
  const activeClassIds = activeClasses.map((c) => c.id);
  const deletedModules = await moduleRepo(supabase).listDeletedByClassIds(activeClassIds);

  // Build a map for quick class lookup
  const classMap = new Map<string, Class>(activeClasses.map((c) => [c.id, c]));

  const empty = deletedClasses.length === 0 && deletedModules.length === 0;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <p className="text-eyebrow text-ink-mute mb-2">Archivo</p>
        <h1 className="text-hero-dashboard font-black text-ink leading-none">
          Elementos eliminados
        </h1>
      </div>

      {empty ? (
        <div className="py-16 text-center">
          <p className="text-body text-ink-soft">El archivo está vacío.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {deletedClasses.length > 0 && (
            <section>
              <h2 className="text-caption text-ink-mute mb-3 uppercase tracking-wide">
                Clases ({deletedClasses.length})
              </h2>
              <div className="bg-surface rounded-[12px] border-subtle px-6">
                {deletedClasses.map((cls) => (
                  <DeletedClassRow key={cls.id} cls={cls} />
                ))}
              </div>
            </section>
          )}

          {deletedModules.length > 0 && (
            <section>
              <h2 className="text-caption text-ink-mute mb-3 uppercase tracking-wide">
                Módulos ({deletedModules.length})
              </h2>
              <div className="bg-surface rounded-[12px] border-subtle px-6">
                {deletedModules.map((mod) => (
                  <DeletedModuleRow key={mod.id} mod={mod} classMap={classMap} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
