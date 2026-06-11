import type { Accent } from "@/lib/schemas/shared";
import type { ContentType } from "@/lib/schemas/content";

export interface Quiz {
  id: string;
  content_id: string;
  instructions: string | null;
  max_score: number;
  passing_score: number | null;
  time_limit_min: number | null;
  shuffle_questions: boolean;
  show_correct_answers: "never" | "after_submit" | "after_close";
  is_available: boolean;
  opens_at: string | null;
  closes_at: string | null;
  attempts_allowed: number;
  attempt_scoring: "best" | "average";
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  order_index: number;
  points: number;
  type: "single_choice" | "multi_choice" | "true_false" | "short_answer" | "map_pin";
  prompt: string;
  body: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email_verified_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface Attempt {
  id: string;
  quiz_id: string | null;
  student_id: string;
  attempt_number: number;
  started_at: string;
  submitted_at: string | null;
  expires_at: string | null;
  score: number | null;
  max_score: number | null;
  status: "in_progress" | "submitted" | "graded" | "abandoned";
  attempt_session_token_hash: string;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttemptQuestion {
  id: string;
  attempt_id: string;
  original_question_id: string | null;
  order_index: number;
  points: number;
  type: string;
  prompt: string;
  body_snapshot: Record<string, unknown>;
  created_at: string;
}

export interface Answer {
  id: string;
  attempt_id: string;
  question_id: string;
  response: Record<string, unknown>;
  is_correct: boolean | null;
  points_awarded: number | null;
  feedback: string | null;
  client_updated_at: string | null;
  updated_at: string;
}

export interface Class {
  id: string;
  professor_id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  accent: Accent;
  lockup_split_at: number | null;
  visibility: "public" | "unlisted";
  is_published: boolean;
  grade_scale: "percent" | "five_point";
  grade_min: number;
  grade_max: number;
  passing_grade: number | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Module {
  id: string;
  class_id: string;
  slug: string;
  order_index: number;
  title: string;
  description: string | null;
  is_published: boolean;
  is_available: boolean;
  opens_at: string | null;
  closes_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Content {
  id: string;
  module_id: string;
  slug: string;
  order_index: number;
  type: ContentType;
  title: string;
  body_draft: Record<string, unknown>;
  body_published: Record<string, unknown>;
  published_at: string | null;
  draft_version: number;
  version: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
