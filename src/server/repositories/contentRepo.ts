import type { SupabaseClient } from "@supabase/supabase-js";
import type { Content } from "@/lib/types/db";
import type { CreateContentInput, UpdateContentInput } from "@/lib/schemas/content";

export function contentRepo(db: SupabaseClient) {
  return {
    async listByModule(moduleId: string): Promise<Content[]> {
      const { data, error } = await db
        .from("contents")
        .select("*")
        .eq("module_id", moduleId)
        .is("deleted_at", null)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },

    async listPublishedByModule(moduleId: string): Promise<Content[]> {
      const { data, error } = await db
        .from("contents")
        .select("*")
        .eq("module_id", moduleId)
        .eq("is_published", true)
        .is("deleted_at", null)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },

    async findBySlug(moduleId: string, slug: string): Promise<Content | null> {
      const { data, error } = await db
        .from("contents")
        .select("*")
        .eq("module_id", moduleId)
        .eq("slug", slug)
        .is("deleted_at", null)
        .single();
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data;
    },

    async create(moduleId: string, input: CreateContentInput, orderIndex: number): Promise<Content> {
      const { data, error } = await db
        .from("contents")
        .insert({ ...input, module_id: moduleId, order_index: orderIndex })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id: string, input: UpdateContentInput): Promise<Content> {
      const { version, ...fields } = input;
      const { data, error } = await db
        .from("contents")
        .update(fields)
        .eq("id", id)
        .eq("version", version)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error("version_mismatch");
      return data;
    },

    async autosave(id: string, bodyDraft: Record<string, unknown>): Promise<void> {
      const { error } = await db
        .from("contents")
        .update({ body_draft: bodyDraft })
        .eq("id", id);
      if (error) throw error;
    },

    async publish(id: string): Promise<Content> {
      const { data: current, error: fetchErr } = await db
        .from("contents")
        .select("body_draft, version")
        .eq("id", id)
        .single();
      if (fetchErr) throw fetchErr;

      const { data, error } = await db
        .from("contents")
        .update({
          body_published: current.body_draft,
          published_at: new Date().toISOString(),
          is_published: true,
          version: current.version + 1,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async softDelete(id: string): Promise<void> {
      const { error } = await db
        .from("contents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
  };
}
