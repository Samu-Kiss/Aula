import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { Lockup } from "@/components/Lockup";
import { DuplicateClassButton } from "./DuplicateClassButton";
import { Plus } from "lucide-react";
import type { Class } from "@/lib/types/db";

function ClassCard({ cls }: { cls: Class }) {
  return (
    <div className="relative group/card">
      <Link
        href={`/dashboard/clases/${cls.id}`}
        className="block p-6 bg-surface rounded-[12px] border-subtle hover:border-ink/20 transition-colors group"
      >
        <Lockup
          title={cls.title}
          accent={cls.accent}
          splitAt={cls.lockup_split_at}
          className="text-[28px]"
        />
        {cls.description && (
          <p className="text-body text-ink-soft mt-3 line-clamp-2">{cls.description}</p>
        )}
        <div className="flex items-center gap-3 mt-4">
          <span className={`inline-flex items-center h-5 px-2 rounded-[4px] text-mono ${
            cls.is_published
              ? "bg-bosque/10 text-bosque"
              : "bg-surface-alt text-ink-mute"
          }`}>
            {cls.is_published ? "Publicada" : "Borrador"}
          </span>
          <span className="text-mono text-ink-mute">/c/{cls.slug}</span>
        </div>
      </Link>
      <div className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <DuplicateClassButton classId={cls.id} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-eyebrow text-ink-mute mb-4">Empecemos</p>
      <h2 className="text-[32px] font-black text-ink leading-none mb-3">
        Crea tu primera clase
      </h2>
      <p className="text-body text-ink-soft max-w-sm mb-8">
        Cada clase tiene su propia URL pública, módulos y contenidos.
      </p>
      <Link
        href="/dashboard/clases/nueva"
        className="inline-flex items-center gap-2 h-11 px-6 rounded-[8px] bg-ink text-surface text-[14px] font-semibold hover:bg-ink/90 transition-colors"
      >
        <Plus size={16} strokeWidth={2.5} />
        Nueva clase
      </Link>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const classes = user ? await classService(supabase).list(user.id) : [];

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-eyebrow text-ink-mute mb-2">Dashboard</p>
          <h1 className="text-hero-dashboard font-black text-ink leading-none">
            Tus clases
          </h1>
        </div>
        {classes.length > 0 && (
          <Link
            href="/dashboard/clases/nueva"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-ink text-surface text-[13px] font-semibold hover:bg-ink/90 transition-colors"
          >
            <Plus size={15} strokeWidth={2.5} />
            Nueva clase
          </Link>
        )}
      </div>

      {classes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} />
          ))}
        </div>
      )}
    </div>
  );
}
