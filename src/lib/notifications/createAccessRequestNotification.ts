import { createServiceClient } from "@/lib/supabase/server";

interface AccessRequestPayload {
  student_name: string;
  student_email: string;
  class_title: string;
  class_id: string;
}

export async function createAccessRequestNotification(
  professorId: string,
  payload: AccessRequestPayload
): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("professor_notifications").insert({
    professor_id: professorId,
    type: "access_request",
    payload,
  });
}
