import { z } from "zod";
import { slugSchema } from "./shared";

export const contentTypeSchema = z.enum([
  "rich_text",
  "video",
  "map",
  "file",
  "quiz",
]);

export const createContentSchema = z.object({
  title: z.string().min(3).max(120),
  slug: slugSchema,
  type: contentTypeSchema,
});

export const updateContentSchema = createContentSchema.partial().extend({
  version: z.number().int().positive(),
  is_published: z.boolean().optional(),
});

export const autosaveContentSchema = z.object({
  body_draft: z.record(z.string(), z.unknown()),
});

export type ContentType = z.infer<typeof contentTypeSchema>;
export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
