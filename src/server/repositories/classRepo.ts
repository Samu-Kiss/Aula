import type { SupabaseClient } from "@supabase/supabase-js";
import type { Class } from "@/lib/types/db";
import type { CreateClassInput, UpdateClassInput } from "@/lib/schemas/class";

export function classRepo(db: SupabaseClient) {
  return {
    async listByProfessor(professorId: string): Promise<Class[]> {
      const { data, error } = await db
        .from("classes")
        .select("*")
        .eq("professor_id", professorId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },

    async findById(id: string): Promise<Class | null> {
      const { data, error } = await db
        .from("classes")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data;
    },

    async findBySlug(slug: string): Promise<Class | null> {
      const { data, error } = await db
        .from("classes")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .is("deleted_at", null)
        .single();
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data;
    },

    async create(professorId: string, input: CreateClassInput): Promise<Class> {
      const { data, error } = await db
        .from("classes")
        .insert({ ...input, professor_id: professorId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id: string, input: UpdateClassInput): Promise<Class> {
      const { version, ...fields } = input;
      const { data, error } = await db
        .from("classes")
        .update(fields)
        .eq("id", id)
        .eq("version", version)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error("version_mismatch");
      return data;
    },

    async softDelete(id: string): Promise<void> {
      const { error } = await db
        .from("classes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },

    async listDeleted(professorId: string): Promise<Class[]> {
      const { data, error } = await db
        .from("classes")
        .select("*")
        .eq("professor_id", professorId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data;
    },

    async restore(id: string): Promise<void> {
      const { error } = await db
        .from("classes")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
  };
}
