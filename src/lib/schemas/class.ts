import { z } from "zod";
import { slugSchema, accentSchema } from "./shared";

export const createClassSchema = z.object({
  title: z.string().min(3).max(80),
  slug: slugSchema,
  description: z.string().max(500).optional(),
  accent: accentSchema.default("indigo"),
  visibility: z.enum(["public", "unlisted"]).default("unlisted"),
});

export const updateClassSchema = createClassSchema.partial().extend({
  version: z.number().int().positive(),
  lockup_split_at: z.number().int().min(1).nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  is_published: z.boolean().optional(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
