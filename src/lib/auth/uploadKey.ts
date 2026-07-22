import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Los uploads guardan objetos bajo claves como `images/{contentId}/...` o
 * `files/{classId}/{contentId}/...`. La ruta la propone el cliente, así que sin
 * validar un profesor podría subir o SOBRESCRIBIR objetos de otro profesor
 * (p. ej. defacear una imagen pública cuya URL es visible en la página
 * publicada, o pisar un archivo privado con clave conocida).
 *
 * Exigimos que la clave contenga el id de un contenido que el profesor posee.
 * Los uploads legítimos siempre incrustan el contentId propio, mientras que las
 * claves de la víctima contienen su propio contentId (no el del atacante).
 */
export async function keyReferencesOwnedContent(
  supabase: SupabaseClient,
  key: string,
  userId: string
): Promise<boolean> {
  const ids = key.match(UUID_RE);
  if (!ids) return false;

  for (const contentId of [...new Set(ids.map((s) => s.toLowerCase()))]) {
    const { data: c } = await supabase
      .from("contents")
      .select("module_id")
      .eq("id", contentId)
      .maybeSingle();
    if (!c?.module_id) continue;

    const { data: m } = await supabase
      .from("modules")
      .select("class_id")
      .eq("id", c.module_id)
      .maybeSingle();
    if (!m?.class_id) continue;

    const { data: cl } = await supabase
      .from("classes")
      .select("professor_id")
      .eq("id", m.class_id)
      .maybeSingle();
    if (cl?.professor_id === userId) return true;
  }

  return false;
}
