import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { ModuleSidebar } from "@/components/dashboard/ModuleSidebar";
import { Lockup } from "@/components/Lockup";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

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
    <div className="flex flex-1 min-h-0 -mx-8 -my-8">
      {/* Module sidebar */}
      <ModuleSidebar classId={id} initialModules={modules} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Class header */}
        <div className="px-8 py-4 border-b border-[rgba(0,0,0,0.08)] flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-ink-mute hover:text-ink transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <Lockup
            title={cls.title}
            accent={cls.accent}
            splitAt={cls.lockup_split_at}
            className="text-[22px]"
          />
          <span className={`ml-auto text-mono px-2 py-0.5 rounded-[4px] ${
            cls.is_published
              ? "bg-bosque/10 text-bosque"
              : "bg-surface-alt text-ink-mute"
          }`}>
            {cls.is_published ? "Publicada" : "Borrador"}
          </span>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
