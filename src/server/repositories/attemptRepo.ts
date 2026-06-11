import type { SupabaseClient } from "@supabase/supabase-js";
import type { Attempt, AttemptQuestion, Answer, Student } from "@/lib/types/db";

export interface AttemptWithStudent extends Attempt {
  student: Pick<Student, "id" | "email" | "first_name" | "last_name" | "display_name" | "is_anonymized">;
}

export function attemptRepo(db: SupabaseClient) {
  return {
    async findById(id: string): Promise<Attempt | null> {
      const { data, error } = await db
        .from("attempts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data;
    },

    async findInProgress(quizId: string, studentId: string): Promise<Attempt | null> {
      const { data } = await db
        .from("attempts")
        .select("*")
        .eq("quiz_id", quizId)
        .eq("student_id", studentId)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },

    async countFinished(quizId: string, studentId: string): Promise<number> {
      const { count } = await db
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", quizId)
        .eq("student_id", studentId)
        .in("status", ["submitted", "graded"]);
      return count ?? 0;
    },

    async create(fields: {
      quiz_id: string;
      student_id: string;
      attempt_number: number;
      expires_at: string | null;
      max_score: number;
      attempt_session_token_hash: string;
      idempotency_key: string | null;
    }): Promise<Attempt> {
      const { data, error } = await db
        .from("attempts")
        .insert({ ...fields, status: "in_progress" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async copyQuestions(attemptId: string, questions: AttemptQuestion[]): Promise<AttemptQuestion[]> {
      const { data, error } = await db
        .from("attempt_questions")
        .insert(
          questions.map((q) => ({
            attempt_id: attemptId,
            original_question_id: q.id,
            order_index: q.order_index,
            points: q.points,
            type: q.type,
            prompt: q.prompt,
            body_snapshot: q.body_snapshot ?? (q as unknown as Record<string, unknown>).body,
          }))
        )
        .select();
      if (error) throw error;
      return data;
    },

    async listQuestions(attemptId: string): Promise<AttemptQuestion[]> {
      const { data, error } = await db
        .from("attempt_questions")
        .select("*")
        .eq("attempt_id", attemptId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },

    async listAnswers(attemptId: string): Promise<Answer[]> {
      const { data, error } = await db
        .from("answers")
        .select("*")
        .eq("attempt_id", attemptId);
      if (error) throw error;
      return data ?? [];
    },

    async upsertAnswer(fields: {
      attempt_id: string;
      question_id: string;
      response: Record<string, unknown>;
      client_updated_at: string;
    }): Promise<void> {
      const { error } = await db
        .from("answers")
        .upsert(fields, { onConflict: "attempt_id,question_id" });
      if (error) throw error;
    },

    async batchUpsertAnswers(answers: {
      attempt_id: string;
      question_id: string;
      response: Record<string, unknown>;
      client_updated_at: string;
    }[]): Promise<void> {
      if (answers.length === 0) return;
      const { error } = await db
        .from("answers")
        .upsert(answers, { onConflict: "attempt_id,question_id" });
      if (error) throw error;
    },

    async listFinishedByStudent(quizId: string, studentId: string): Promise<Attempt[]> {
      const { data, error } = await db
        .from("attempts")
        .select("*")
        .eq("quiz_id", quizId)
        .eq("student_id", studentId)
        .in("status", ["submitted", "graded"])
        .order("attempt_number", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    async listByQuiz(quizId: string): Promise<AttemptWithStudent[]> {
      const { data, error } = await db
        .from("attempts")
        .select("*, student:students(id, email, first_name, last_name, display_name, is_anonymized)")
        .eq("quiz_id", quizId)
        .in("status", ["submitted", "graded"])
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttemptWithStudent[];
    },

    async submit(attemptId: string): Promise<Attempt> {
      const { data, error } = await db
        .from("attempts")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", attemptId)
        .eq("status", "in_progress")
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /** Bulk-fetch anti-cheating events for a list of attempt IDs. */
    async listEventsByAttemptIds(
      attemptIds: string[]
    ): Promise<{ attempt_id: string; type: string; occurred_at: string }[]> {
      if (attemptIds.length === 0) return [];
      const { data } = await db
        .from("attempt_events")
        .select("attempt_id, type, occurred_at")
        .in("attempt_id", attemptIds)
        .order("occurred_at", { ascending: true });
      return (data ?? []) as { attempt_id: string; type: string; occurred_at: string }[];
    },

    /** Fetch all anti-cheating events for one attempt. */
    async listEventsByAttempt(
      attemptId: string
    ): Promise<{ id: string; type: string; occurred_at: string; payload: Record<string, unknown> | null }[]> {
      const { data } = await db
        .from("attempt_events")
        .select("id, type, occurred_at, payload")
        .eq("attempt_id", attemptId)
        .order("occurred_at", { ascending: true });
      return (data ?? []) as { id: string; type: string; occurred_at: string; payload: Record<string, unknown> | null }[];
    },
  };
}
