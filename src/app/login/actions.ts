"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Solo permite rutas internas como destino post-login. El `next` llega desde
 * `/login?next=...` (campo oculto del formulario), así que sin validarlo un
 * atacante podría enviar `/login?next=https://evil.com` y usar el login como
 * open redirect para phishing. Se rechaza cualquier cosa que no sea una ruta
 * relativa del propio sitio (debe empezar por "/" y no por "//").
 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function loginAction(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = safeNext(formData.get("next"));

  let authFailed = false;
  let serviceDown = false;

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) authFailed = true;
  } catch {
    // fetch failed — Supabase unreachable
    serviceDown = true;
  }

  if (serviceDown) {
    redirect(
      `/login?error=${encodeURIComponent("Servicio no disponible. Intenta de nuevo en unos minutos.")}`
    );
  }
  if (authFailed) {
    redirect(
      `/login?error=${encodeURIComponent("Correo o contraseña incorrectos.")}`
    );
  }

  redirect(next);
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(
      `/login/recuperar?error=${encodeURIComponent("Escribe un correo válido.")}`
    );
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    // El enlace del correo pasa por /auth/confirm, que verifica el token y
    // redirige a la página de nueva contraseña con sesión ya iniciada.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/confirm?next=/restablecer-contrasena`,
    });
  } catch {
    redirect(
      `/login/recuperar?error=${encodeURIComponent("Servicio no disponible. Intenta de nuevo en unos minutos.")}`
    );
  }

  // Siempre confirmamos, exista o no la cuenta (evita enumerar correos).
  redirect("/login/recuperar?sent=1");
}

export async function updatePasswordAction(formData: FormData) {
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!password || password.length < 8) {
    redirect(
      `/restablecer-contrasena?error=${encodeURIComponent("La contraseña debe tener al menos 8 caracteres.")}`
    );
  }
  if (password !== confirm) {
    redirect(
      `/restablecer-contrasena?error=${encodeURIComponent("Las contraseñas no coinciden.")}`
    );
  }

  const supabase = await createClient();

  let errorMsg: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      redirect(
        `/login?error=${encodeURIComponent("El enlace venció o ya fue usado. Solicita uno nuevo.")}`
      );
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      errorMsg =
        error.code === "same_password"
          ? "La nueva contraseña debe ser distinta a la actual."
          : "No se pudo actualizar la contraseña. Intenta de nuevo.";
    }
  } catch (e) {
    // redirect() lanza internamente — no tragarlo
    if (e && typeof e === "object" && "digest" in e) throw e;
    errorMsg = "Servicio no disponible. Intenta de nuevo en unos minutos.";
  }

  if (errorMsg) {
    redirect(`/restablecer-contrasena?error=${encodeURIComponent(errorMsg)}`);
  }

  redirect("/restablecer-contrasena?ok=1");
}

export async function logoutAction() {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch {
    // If backend is down, sign out locally by clearing the cookie via redirect.
  }
  redirect("/login");
}
