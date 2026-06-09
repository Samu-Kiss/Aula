import { Resend } from "resend";

export async function sendAttemptReceived(
  to: string,
  firstName: string,
  quizTitle: string,
  className: string,
  score: number,
  maxScore: number,
  hasPendingManual: boolean
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n📧 Intento recibido [${to}]: ${quizTitle} — ${score}/${maxScore}${hasPendingManual ? " (revisión pendiente)" : ""}\n`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Aula <hola@aula.com>",
    to,
    template: {
      id: "quiz-submission-confirmation",
      variables: {
        first_name: firstName,
        quiz_title: quizTitle,
        class_name: className,
        score,
        max_score: maxScore,
      },
    },
  });
}
