import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { accentVars } from "@/lib/accentColors";

interface Props {
  children: React.ReactNode;
  params: Promise<{ classSlug: string }>;
}

/**
 * Tinta de clase para todas las rutas públicas de /c/[classSlug]:
 * focus rings, ::selection, botones primarios y detalles de progreso
 * resuelven el acento de la clase via --class-accent.
 */
export default async function PublicClassLayout({ children, params }: Props) {
  const { classSlug } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getBySlug(classSlug);

  if (!cls) return children;

  return (
    <div className="contents" style={accentVars(cls.accent)}>
      {children}
    </div>
  );
}
