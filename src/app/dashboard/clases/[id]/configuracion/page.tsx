import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { PublishClassToggle } from "./PublishClassToggle";
import { ClassMetaForm } from "./ClassMetaForm";
import { DeleteClassButton } from "./DeleteClassButton";
import { ClassQrCode } from "@/components/dashboard/ClassQrCode";
import { ACCENT_HEX } from "@/lib/accentColors";

interface Props {
  params: Promise<{ id: string }>;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getById(id);
  if (!cls) notFound();

  const classUrl = `${APP_URL}/c/${cls.slug}`;
  const hex = ACCENT_HEX[cls.accent] ?? "#4C51BF";

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

      {/* QR de acceso */}
      <section className="bg-surface border-subtle rounded-[12px] p-6">
        <h2 className="text-h2 text-ink mb-1">QR de acceso</h2>
        <p className="text-body text-ink-soft mb-5">
          Código QR con el color de acento de la clase. Proyéctalo o descárgalo para compartir.
        </p>
        <ClassQrCode url={classUrl} accentHex={hex} classId={id} classTitle={cls.title} accent={cls.accent} splitAt={cls.lockup_split_at} />
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

      {/* Zona de peligro */}
      <section className="border border-borgona/25 rounded-[12px] p-6">
        <h2 className="text-h2 text-borgona mb-1">Zona de peligro</h2>
        <p className="text-body text-ink-soft mb-5">
          Eliminar la clase borra permanentemente todos sus módulos, contenidos y configuración.
          Los intentos de estudiantes y calificaciones se conservan en la base de datos pero
          dejarán de ser accesibles.
        </p>
        <DeleteClassButton classId={id} classTitle={cls.title} />
      </section>
    </div>
  );
}
