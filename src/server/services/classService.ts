import type { SupabaseClient } from "@supabase/supabase-js";
import { classRepo } from "@/server/repositories/classRepo";
import { createClassSchema, updateClassSchema } from "@/lib/schemas/class";
import type { Class } from "@/lib/types/db";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function classService(db: SupabaseClient) {
  const repo = classRepo(db);

  return {
    async list(professorId: string): Promise<Class[]> {
      return repo.listByProfessor(professorId);
    },

    async getById(id: string): Promise<Class | null> {
      return repo.findById(id);
    },

    async getBySlug(slug: string): Promise<Class | null> {
      return repo.findBySlug(slug);
    },

    suggestSlug(title: string): string {
      return slugify(title);
    },

    async create(professorId: string, raw: unknown): Promise<Class> {
      const input = createClassSchema.parse(raw);
      return repo.create(professorId, input);
    },

    async update(id: string, raw: unknown): Promise<Class> {
      const input = updateClassSchema.parse(raw);
      return repo.update(id, input);
    },

    async softDelete(id: string): Promise<void> {
      return repo.softDelete(id);
    },
  };
}
