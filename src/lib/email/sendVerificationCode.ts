import { Resend } from "resend";

export async function sendVerificationCode(
  to: string,
  firstName: string,
  code: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n📧 Código de verificación para ${to}: ${code}\n`);
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
