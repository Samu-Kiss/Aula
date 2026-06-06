import type { SupabaseClient } from "@supabase/supabase-js";
import type { Quiz, QuizQuestion } from "@/lib/types/db";

export function quizRepo(db: SupabaseClient) {
  return {
    async findByContentId(contentId: string): Promise<Quiz | null> {
      const { data, error } = await db
        .from("quizzes")
        .select("*")
        .eq("content_id", contentId)
        .single();
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data;
    },

    async findById(id: string): Promise<Quiz | null> {
      const { data, error } = await db
        .from("quizzes")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data;
    },

    async create(contentId: string): Promise<Quiz> {
      const { data, error } = await db
        .from("quizzes")
        .insert({ content_id: contentId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async updateSettings(id: string, fields: Partial<Quiz>): Promise<Quiz> {
      const { data, error } = await db
        .from("quizzes")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async listQuestions(quizId: string): Promise<QuizQuestion[]> {
      const { data, error } = await db
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },

    async listQuestionsPublic(quizId: string): Promise<QuizQuestion[]> {
      const { data, error } = await db
        .from("quiz_questions_public")
        .select("*")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },

    async upsertQuestion(quizId: string, q: Partial<QuizQuestion> & { type: string; prompt: string; points: number; body: Record<string, unknown> }, orderIndex: number): Promise<QuizQuestion> {
      const payload = { quiz_id: quizId, order_index: orderIndex, ...q };
      const { data, error } = q.id
        ? await db.from("quiz_questions").update(payload).eq("id", q.id).select().single()
        : await db.from("quiz_questions").insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async deleteQuestion(id: string): Promise<void> {
      const { error } = await db.from("quiz_questions").delete().eq("id", id);
      if (error) throw error;
    },

    async reorderQuestions(updates: { id: string; order_index: number }[]): Promise<void> {
      await Promise.all(
        updates.map(({ id, order_index }) =>
          db.from("quiz_questions").update({ order_index }).eq("id", id)
        )
      );
    },
  };
}
