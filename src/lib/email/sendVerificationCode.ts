import { Resend } from "resend";

export async function sendVerificationCode(
  to: string,
  firstName: string,
  code: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY || process.env.NODE_ENV !== "production") {
    console.log(`\n📧 Código de verificación para ${to}: ${code}\n`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Aula <hola@aula.com>",
    to,
    subject: "Tu código de verificación — Aula",
    html: `
      <p>Hola ${firstName},</p>
      <p>Tu código de verificación es:</p>
      <h2 style="font-size:32px;letter-spacing:8px;font-family:monospace">${code}</h2>
      <p>Válido por 10 minutos. Si no solicitaste este código, ignora este mensaje.</p>
    `,
  });
}
