import { Resend } from "resend";

export async function sendVerificationCode(
  to: string,
  firstName: string,
  code: string
): Promise<void> {
  // En desarrollo el código siempre se loguea para poder hacer QA local
  // aunque RESEND_API_KEY esté configurada.
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n📧 Código de verificación para ${to}: ${code}\n`);
  }
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Aula <hola@aula.com>",
    to,
    template: {
      id: "aula-verification",
      variables: { first_name: firstName, code },
    },
  });
}
