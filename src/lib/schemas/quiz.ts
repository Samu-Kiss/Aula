import { z } from "zod";

const choiceOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(200),
  is_correct: z.boolean(),
});

export const quizQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("single_choice"),
    prompt: z.string().min(5).max(1000),
    points: z.number().min(0.25).max(100),
    body: z.object({
      options: z
        .array(choiceOptionSchema)
        .min(2)
        .max(10)
        .refine((opts) => opts.filter((o) => o.is_correct).length === 1, {
          message: "Debe haber exactamente una opción correcta.",
        }),
      explanation: z.string().max(500).optional(),
    }),
  }),
  z.object({
    type: z.literal("multi_choice"),
    prompt: z.string().min(5).max(1000),
    points: z.number().min(0.25).max(100),
    body: z.object({
      options: z
        .array(choiceOptionSchema)
        .min(2)
        .max(10)
        .refine((opts) => opts.filter((o) => o.is_correct).length >= 1, {
          message: "Debe haber al menos una opción correcta.",
        }),
      explanation: z.string().max(500).optional(),
    }),
  }),
  z.object({
    type: z.literal("true_false"),
    prompt: z.string().min(5).max(1000),
    points: z.number().min(0.25).max(100),
    body: z.object({
      correct: z.boolean(),
      explanation: z.string().max(500).optional(),
    }),
  }),
  z.object({
    type: z.literal("short_answer"),
    prompt: z.string().min(5).max(1000),
    points: z.number().min(0.25).max(100),
    body: z.object({
      accepted_answers: z.array(z.string().min(1).max(100)).min(1).max(10),
      case_sensitive: z.boolean().default(false),
      auto_grade: z.boolean().default(true),
    }),
  }),
]);

export const updateQuizSettingsSchema = z.object({
  instructions: z.string().max(1000).optional(),
  time_limit_min: z.number().int().min(1).max(180).nullable().optional(),
  attempts_allowed: z.number().int().min(1).max(5).default(1),
  attempt_scoring: z.enum(["best", "average"]).default("best"),
  show_correct_answers: z
    .enum(["never", "after_submit", "after_close"])
    .default("after_close"),
  shuffle_questions: z.boolean().default(false),
  max_score: z.number().min(1).max(1000).default(100),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type UpdateQuizSettingsInput = z.infer<typeof updateQuizSettingsSchema>;
