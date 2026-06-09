import { createServiceClient } from "@/lib/supabase/server";

interface AttemptPayload {
  student_name: string;
  student_email: string;
  content_title: string;
  class_title: string;
  class_id: string;
  attempt_id: string;
  score: number;
  max_score: number;
  has_pending_manual: boolean;
}

export async function createAttemptNotification(
  professorId: string,
  payload: AttemptPayload
): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("professor_notifications").insert({
    professor_id: professorId,
    type: "attempt_submitted",
    payload,
  });
}
