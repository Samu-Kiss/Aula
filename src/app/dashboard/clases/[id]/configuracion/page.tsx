import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConfiguracionPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getById(id);
  if (!cls) notFound();

  return (
    <div className="max-w-xl">
      <p className="text-eyebrow text-ink-mute mb-2">Clase</p>
      <h1 className="text-h1 text-ink mb-6">Configuración</h1>
      <p className="text-body text-ink-soft">
        Configuración de slug, visibilidad y publicación — próximamente.
      </p>
    </div>
  );
}
