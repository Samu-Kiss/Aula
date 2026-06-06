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
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  const supabase = createServiceClient();

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

  await sendVerificationCode(email, first_name, code);

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
