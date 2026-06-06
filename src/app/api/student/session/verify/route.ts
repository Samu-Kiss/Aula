import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { studentSessionVerifySchema } from "@/lib/schemas/student";
import { hashCode } from "@/lib/auth/emailCode";
import { signStudentJwt, buildStudentCookie } from "@/lib/auth/studentJwt";

// POST /api/student/session/verify — verificar código y emitir cookie JWT
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = studentSessionVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, code, first_name, last_name, remember_me } = parsed.data;
  const codeHash = hashCode(code);
  const supabase = createServiceClient();

  // Buscar el código más reciente válido para este email
  const { data: emailCode, error: codeError } = await supabase
    .from("student_email_codes")
    .select("id, code_hash, expires_at, consumed_at")
    .eq("email", email)
    .eq("purpose", "quiz_login")
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (codeError || !emailCode) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  if (emailCode.code_hash !== codeHash) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  // Marcar el código como consumido
  await supabase
    .from("student_email_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", emailCode.id);

  // Buscar estudiante activo por email
  const { data: existing } = await supabase
    .from("students")
    .select("id, email")
    .eq("email", email)
    .eq("is_anonymized", false)
    .maybeSingle();

  let student: { id: string; email: string } | null = existing;

  if (!student) {
    const { data: created, error: createError } = await supabase
      .from("students")
      .insert({ email, first_name, last_name, email_verified_at: new Date().toISOString() })
      .select("id, email")
      .single();
    if (createError || !created) {
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
    student = created;
  } else {
    await supabase
      .from("students")
      .update({ first_name, last_name, email_verified_at: new Date().toISOString() })
      .eq("id", student.id);
  }

  const token = await signStudentJwt(
    { student_id: student.id, email: student.email },
    remember_me
  );

  const cookie = buildStudentCookie(token, remember_me);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie);
  return response;
}
