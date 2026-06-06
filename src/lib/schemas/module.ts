import { z } from "zod";
import { slugSchema } from "./shared";

export const createModuleSchema = z.object({
  title: z.string().min(3).max(80),
  slug: slugSchema,
  description: z.string().max(500).optional(),
});

export const updateModuleSchema = createModuleSchema.partial().extend({
  version: z.number().int().positive(),
});

export const moduleAvailabilitySchema = z
  .object({
    is_published: z.boolean(),
    is_available: z.boolean(),
    opens_at: z.string().datetime().nullable(),
    closes_at: z.string().datetime().nullable(),
  })
  .refine(
    (d) => !d.opens_at || !d.closes_at || d.opens_at < d.closes_at,
    { message: "closes_at debe ser posterior a opens_at" }
  );

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type ModuleAvailabilityInput = z.infer<typeof moduleAvailabilitySchema>;
