import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de los enlaces de correo de Supabase Auth (recuperación de
 * contraseña, confirmación de email, magic link). Soporta ambos formatos:
 *
 * - `?token_hash=...&type=recovery` — plantilla de email personalizada con
 *   `{{ .TokenHash }}` (recomendado por @supabase/ssr).
 * - `?code=...` — flujo PKCE por defecto: el enlace `{{ .ConfirmationURL }}`
 *   pasa por el endpoint /auth/v1/verify de Supabase y redirige aquí con un
 *   código intercambiable por sesión.
 *
 * En ambos casos deja la sesión en cookies y redirige a `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // Solo rutas relativas del propio sitio (evita open redirect).
  const rawNext = searchParams.get("next") ?? "";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : type === "recovery"
        ? "/restablecer-contrasena"
        : "/dashboard";

  const supabase = await createClient();

  let failed = false;
  try {
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      failed = !!error;
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      failed = !!error;
    } else {
      failed = true;
    }
  } catch {
    failed = true;
  }

  if (failed) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("El enlace es inválido o ya venció. Solicita uno nuevo.")}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
