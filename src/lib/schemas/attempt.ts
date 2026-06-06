import { z } from "zod";

export const startAttemptSchema = z.object({
  idempotency_key: z.string().uuid().optional(),
});

export const answerDraftSchema = z.object({
  question_id: z.string().uuid(),
  response: z.unknown(),
  client_updated_at: z.string().datetime().optional(),
});

export const batchAnswersSchema = z.object({
  answers: z.array(answerDraftSchema).min(1).max(50),
});

export const submitAttemptSchema = z.object({
  attempt_session_token: z.string().min(32),
});

export type AnswerDraft = z.infer<typeof answerDraftSchema>;
export type BatchAnswers = z.infer<typeof batchAnswersSchema>;
