"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/dashboard";

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

export async function logoutAction() {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch {
    // If backend is down, sign out locally by clearing the cookie via redirect.
  }
  redirect("/login");
}
