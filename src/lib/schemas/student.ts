import { z } from "zod";

export const studentSessionRequestSchema = z.object({
  email: z.string().email().max(320),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  remember_me: z.boolean().default(false),
});

export const studentSessionVerifySchema = z.object({
  email: z.string().email().max(320),
  code: z.string().regex(/^\d{6}$/, "El código debe ser de 6 dígitos."),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  remember_me: z.boolean().default(false),
});

export type StudentSessionRequest = z.infer<typeof studentSessionRequestSchema>;
export type StudentSessionVerify = z.infer<typeof studentSessionVerifySchema>;
