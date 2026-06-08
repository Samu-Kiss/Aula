import type { SupabaseClient } from "@supabase/supabase-js";
import type { Module } from "@/lib/types/db";
import type { CreateModuleInput, UpdateModuleInput } from "@/lib/schemas/module";

export function moduleRepo(db: SupabaseClient) {
  return {
    async listByClass(classId: string): Promise<Module[]> {
      const { data, error } = await db
        .from("modules")
        .select("*")
        .eq("class_id", classId)
        .is("deleted_at", null)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },

    async listPublishedByClass(classId: string): Promise<Module[]> {
      const { data, error } = await db
        .from("modules")
        .select("*")
        .eq("class_id", classId)
        .eq("is_published", true)
        .is("deleted_at", null)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },

    async findBySlug(classId: string, slug: string): Promise<Module | null> {
      const { data, error } = await db
        .from("modules")
        .select("*")
        .eq("class_id", classId)
        .eq("slug", slug)
        .is("deleted_at", null)
        .single();
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data;
    },

    async create(classId: string, input: CreateModuleInput, orderIndex: number): Promise<Module> {
      const { data, error } = await db
        .from("modules")
        .insert({ ...input, class_id: classId, order_index: orderIndex })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id: string, input: UpdateModuleInput): Promise<Module> {
      const { version, ...fields } = input;
      const { data, error } = await db
        .from("modules")
        .update(fields)
        .eq("id", id)
        .eq("version", version)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error("version_mismatch");
      return data;
    },

    async reorder(updates: { id: string; order_index: number }[]): Promise<void> {
      await Promise.all(
        updates.map(({ id, order_index }) =>
          db.from("modules").update({ order_index }).eq("id", id)
        )
      );
    },

    async softDelete(id: string): Promise<void> {
      const { error } = await db
        .from("modules")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },

    async listDeletedByClassIds(classIds: string[]): Promise<Module[]> {
      if (classIds.length === 0) return [];
      const { data, error } = await db
        .from("modules")
        .select("*")
        .in("class_id", classIds)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data;
    },

    async restore(id: string): Promise<void> {
      const { error } = await db
        .from("modules")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
  };
}
