import { Resend } from "resend";

export async function sendGradeReady(
  to: string,
  firstName: string,
  itemTitle: string,
  className: string,
  score: number,
  maxScore: number
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n📧 Nota lista [${to}]: ${itemTitle} → ${score}/${maxScore}\n`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Aula <hola@aula.com>",
    to,
    template: {
      id: "grade-available",
      variables: {
        first_name: firstName,
        item_title: itemTitle,
        class_name: className,
        score,
        max_score: maxScore,
      },
    },
  });
}
