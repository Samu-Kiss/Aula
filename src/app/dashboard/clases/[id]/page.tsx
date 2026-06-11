import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { ClassQrCode } from "@/components/dashboard/ClassQrCode";
import { ACCENT_HEX } from "@/lib/accentColors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClassOverviewPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const cls = await classService(supabase).getById(id);
  if (!cls) notFound();

  const modules = await moduleRepo(supabase).listByClass(id);
  const classUrl = `${APP_URL}/c/${cls.slug}`;
  const hex = ACCENT_HEX[cls.accent] ?? "#4C51BF";

  return (
    <div className="max-w-xl">
      <p className="text-eyebrow text-ink-mute mb-2">Clase</p>
      {cls.description && (
        <p className="text-body text-ink-soft mb-6">{cls.description}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
          <p className="text-mono text-ink leading-none pt-1 break-all">/c/{cls.slug}</p>
          <p className="text-caption text-ink-mute mt-1">URL pública</p>
        </div>
      </div>

      <section className="bg-surface border-subtle rounded-[12px] p-6 mb-6">
        <h2 className="text-h2 text-ink mb-1">QR de acceso</h2>
        <p className="text-body text-ink-soft mb-5">
          Comparte o proyecta este código para que los estudiantes accedan a la clase.
        </p>

        {!cls.is_published && (
          <div className="flex items-start gap-3 rounded-[10px] border border-ambar/40 bg-ambar/10 p-3 mb-5">
            <AlertTriangle size={16} className="text-ambar shrink-0 mt-0.5" />
            <p className="text-caption text-ink-soft leading-snug">
              La clase está en <span className="font-medium text-ink">borrador</span>: este enlace
              mostrará un error a los estudiantes hasta que la publiques.{" "}
              <Link
                href={`/dashboard/clases/${id}/configuracion`}
                className="font-medium text-ink underline underline-offset-2 hover:no-underline"
              >
                Publicar clase
              </Link>
            </p>
          </div>
        )}

        <ClassQrCode url={classUrl} accentHex={hex} classId={id} classTitle={cls.title} accent={cls.accent} splitAt={cls.lockup_split_at} />
      </section>

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
