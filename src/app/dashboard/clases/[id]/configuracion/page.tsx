import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { PublishClassToggle } from "./PublishClassToggle";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConfiguracionPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getById(id);
  if (!cls) notFound();

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <p className="text-eyebrow text-ink-mute mb-1">Configuración</p>
        <h1 className="text-h1 text-ink">{cls.title}</h1>
      </div>

      {/* Visibilidad */}
      <section className="bg-surface border-subtle rounded-[12px] p-6">
        <h2 className="text-h2 text-ink mb-1">Visibilidad</h2>
        <p className="text-body text-ink-soft mb-5">
          Una clase publicada es accesible en <span className="text-mono text-ink">/c/{cls.slug}</span>. Los módulos y contenidos tienen su propia visibilidad independiente.
        </p>
        <PublishClassToggle classId={id} isPublished={cls.is_published} />
      </section>

      {/* URL */}
      <section className="bg-surface border-subtle rounded-[12px] p-6">
        <h2 className="text-h2 text-ink mb-1">URL pública</h2>
        <p className="text-mono text-ink-soft break-all">
          {process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/c/{cls.slug}
        </p>
      </section>
    </div>
  );
}
