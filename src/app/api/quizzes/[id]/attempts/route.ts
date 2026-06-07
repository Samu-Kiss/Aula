import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";
import { quizRepo } from "@/server/repositories/quizRepo";
import { attemptRepo } from "@/server/repositories/attemptRepo";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// GET /api/quizzes/[id]/attempts — historial de intentos del estudiante identificado
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: quizId } = await params;
  const student = await getStudentFromCookie();
  if (!student) return NextResponse.json({ attempts: [] });

  const supabase = createServiceClient();
  const attempts = await attemptRepo(supabase).listFinishedByStudent(quizId, student.student_id);
  return NextResponse.json({ attempts });
}

// POST /api/quizzes/[id]/attempts — iniciar o retomar un intento
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: quizId } = await params;

  // 1. Verificar identidad del estudiante
  const student = await getStudentFromCookie();
  if (!student) {
    return NextResponse.json({ error: "not_identified" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const idempotencyKey: string | null = body.idempotency_key ?? null;

  const supabase = createServiceClient();
  const qRepo = quizRepo(supabase);
  const aRepo = attemptRepo(supabase);

  // 2. Cargar quiz y verificar disponibilidad
  const quiz = await qRepo.findById(quizId);
  if (!quiz || quiz.deleted_at) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }

  const now = new Date();
  if (!quiz.is_available) {
    return NextResponse.json({ error: "quiz_unavailable" }, { status: 403 });
  }
  if (quiz.opens_at && new Date(quiz.opens_at) > now) {
    return NextResponse.json({ error: "quiz_not_open_yet" }, { status: 403 });
  }
  if (quiz.closes_at && new Date(quiz.closes_at) < now) {
    return NextResponse.json({ error: "quiz_closed" }, { status: 403 });
  }

  // 3. Verificar si ya hay un intento en progreso para este estudiante → retomar
  const existing = await aRepo.findInProgress(quizId, student.student_id);
  if (existing) {
    // Si no ha expirado, retomar
    if (!existing.expires_at || new Date(existing.expires_at) > now) {
      const questions = await aRepo.listQuestions(existing.id);
      const answers = await aRepo.listAnswers(existing.id);
      const sessionToken = randomBytes(32).toString("hex");
      // Actualizar el session token para esta sesión
      await supabase
        .from("attempts")
        .update({ attempt_session_token_hash: hashToken(sessionToken) })
        .eq("id", existing.id);

      const response = NextResponse.json({
        attempt: existing,
        questions,
        answers,
        session_token: sessionToken,
        resumed: true,
      });
      response.cookies.set(`aula_attempt_${existing.id}`, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: existing.expires_at
          ? Math.floor((new Date(existing.expires_at).getTime() - now.getTime()) / 1000)
          : 86400,
      });
      return response;
    }
    // Expirado: marcar como abandonado
    await supabase.from("attempts").update({ status: "abandoned" }).eq("id", existing.id);
  }

  // 4. Verificar límite de intentos
  const finished = await aRepo.countFinished(quizId, student.student_id);
  if (finished >= (quiz.attempts_allowed ?? 1)) {
    return NextResponse.json({ error: "attempts_exhausted" }, { status: 403 });
  }

  // 5. Cargar preguntas del quiz (con shuffle si aplica)
  let questions = await qRepo.listQuestions(quizId);
  if (quiz.shuffle_questions) {
    questions = questions.sort(() => Math.random() - 0.5);
    questions = questions.map((q, i) => ({ ...q, order_index: i }));
  }

  if (questions.length === 0) {
    return NextResponse.json({ error: "quiz_has_no_questions" }, { status: 400 });
  }

  // 6. Calcular max_score y expires_at
  const maxScore = questions.reduce((acc, q) => acc + (q.points ?? 0), 0);
  const expiresAt = quiz.time_limit_min
    ? new Date(now.getTime() + quiz.time_limit_min * 60 * 1000).toISOString()
    : null;

  // 7. Generar session token
  const sessionToken = randomBytes(32).toString("hex");
  const sessionTokenHash = hashToken(sessionToken);

  // 8. Crear intento
  const attempt_number = finished + 1;
  let attempt;
  try {
    attempt = await aRepo.create({
      quiz_id: quizId,
      student_id: student.student_id,
      attempt_number,
      expires_at: expiresAt,
      max_score: maxScore,
      attempt_session_token_hash: sessionTokenHash,
      idempotency_key: idempotencyKey,
    });
  } catch (err: unknown) {
    // unique violation en idempotency_key → doble click, buscar intento existente
    const e = err as { code?: string };
    if (e?.code === "23505") {
      const retry = await aRepo.findInProgress(quizId, student.student_id);
      if (retry) {
        const qs = await aRepo.listQuestions(retry.id);
        const as = await aRepo.listAnswers(retry.id);
        return NextResponse.json({ attempt: retry, questions: qs, answers: as, session_token: sessionToken, resumed: true });
      }
    }
    throw err;
  }

  // 9. Copiar preguntas como snapshot
  const attemptQuestions = await aRepo.copyQuestions(attempt.id, questions as never);

  const response = NextResponse.json({
    attempt,
    questions: attemptQuestions,
    answers: [],
    session_token: sessionToken,
    resumed: false,
  });

  response.cookies.set(`aula_attempt_${attempt.id}`, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: expiresAt
      ? Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000)
      : 86400,
  });

  return response;
}
