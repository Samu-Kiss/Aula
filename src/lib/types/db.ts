import type { Accent } from "@/lib/schemas/shared";
import type { ContentType } from "@/lib/schemas/content";

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
