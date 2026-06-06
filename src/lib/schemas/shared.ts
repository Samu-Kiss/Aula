import { z } from "zod";

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo lowercase, números y guiones.")
  .min(3)
  .max(60);

export const accentSchema = z.enum([
  "indigo",
  "terracota",
  "bosque",
  "ciruela",
  "ambar",
  "pizarra",
  "borgona",
  "salvia",
]);

export type Accent = z.infer<typeof accentSchema>;
