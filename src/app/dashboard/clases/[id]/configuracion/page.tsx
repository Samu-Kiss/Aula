import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { PublishClassToggle } from "./PublishClassToggle";
import { ClassMetaForm } from "./ClassMetaForm";

interface Props {
  params: Promise<{ id: string }>;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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

      {/* Información básica */}
      <section className="bg-surface border-subtle rounded-[12px] p-6">
        <h2 className="text-h2 text-ink mb-1">Información</h2>
        <p className="text-body text-ink-soft mb-5">
          Título, slug y descripción de la clase.
        </p>
        <ClassMetaForm
          classId={id}
          initialTitle={cls.title}
          initialSlug={cls.slug}
          initialDescription={cls.description}
          appUrl={APP_URL}
        />
      </section>

      {/* Visibilidad */}
      <section className="bg-surface border-subtle rounded-[12px] p-6">
        <h2 className="text-h2 text-ink mb-1">Visibilidad</h2>
        <p className="text-body text-ink-soft mb-5">
          Una clase publicada es accesible en{" "}
          <span className="text-mono text-ink">/c/{cls.slug}</span>.
          Los módulos y contenidos tienen su propia visibilidad independiente.
        </p>
        <PublishClassToggle classId={id} isPublished={cls.is_published} />
      </section>
    </div>
  );
}
