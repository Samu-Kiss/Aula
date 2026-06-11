import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { studentSessionRequestSchema } from "@/lib/schemas/student";
import { generateCode, hashCode } from "@/lib/auth/emailCode";
import { sendVerificationCode } from "@/lib/email/sendVerificationCode";

// POST /api/student/session — solicitar código de verificación
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = studentSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, first_name } = parsed.data;
  const supabase = createServiceClient();

  // ── Rate limiting: máx 3 códigos por email en los últimos 10 min ─────────────
  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("student_email_codes")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: "rate_limited", message: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // Guardar código hasheado
  const { error } = await supabase.from("student_email_codes").insert({
    email,
    code_hash: codeHash,
    purpose: "quiz_login",
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  try {
    await sendVerificationCode(email, first_name, code);
  } catch {
    // En desarrollo el código ya quedó logueado en consola; en producción
    // un fallo de envío sí debe reportarse al estudiante.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "send_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/student/session — cerrar sesión
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("aula_student", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
