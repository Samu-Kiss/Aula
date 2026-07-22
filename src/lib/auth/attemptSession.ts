import { cookies } from "next/headers";
import { createHash } from "crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * ¿La petición proviene de la sesión de intento ACTIVA?
 *
 * Cada vez que un estudiante inicia o reanuda un intento se rota el token: se
 * guarda su hash en `attempt_session_token_hash` y se emite la cookie
 * `aula_attempt_{id}`. Así solo la sesión más reciente puede escribir — si el
 * mismo alumno (o alguien con su sesión) abre el intento en otro dispositivo o
 * pestaña, la sesión anterior deja de poder guardar respuestas o entregar.
 *
 * Esto cierra la brecha de "múltiples sesiones abiertas del mismo intento": sin
 * la verificación, dos personas podrían responder/entregar en paralelo, porque
 * la única autorización era la cookie JWT del estudiante (compartible).
 *
 * Los intentos creados antes de esta protección no tienen hash: en ese caso no
 * se bloquea (compatibilidad hacia atrás).
 */
export async function isActiveAttemptSession(
  attemptId: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!storedHash) return true;
  const cookieStore = await cookies();
  const token = cookieStore.get(`aula_attempt_${attemptId}`)?.value;
  if (!token) return false;
  return hashToken(token) === storedHash;
}
