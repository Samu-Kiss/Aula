-- ============================================================
-- CONTENIDO
-- ============================================================

create table classes (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  title text not null check (char_length(title) between 3 and 80),
  description text check (description is null or char_length(description) <= 500),
  cover_url text,

  accent text not null default 'indigo'
    check (accent in ('indigo','terracota','bosque','ciruela','ambar','pizarra','borgona','salvia')),
  lockup_split_at int check (lockup_split_at is null or lockup_split_at >= 1),

  visibility text not null default 'unlisted'
    check (visibility in ('public','unlisted')),
  is_published boolean not null default false,

  grade_scale text not null default 'percent'
    check (grade_scale in ('percent','five_point')),
  grade_min numeric not null default 0,
  grade_max numeric not null default 100,
  passing_grade numeric,
  check (grade_min < grade_max),
  check (passing_grade is null or (passing_grade >= grade_min and passing_grade <= grade_max)),

  version int not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  slug text not null,
  order_index int not null default 0,
  title text not null check (char_length(title) between 3 and 80),
  description text check (description is null or char_length(description) <= 500),
  is_published boolean not null default false,

  is_available boolean not null default true,
  opens_at timestamptz,
  closes_at timestamptz,
  check (opens_at is null or closes_at is null or opens_at < closes_at),

  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table contents (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  slug text not null,
  order_index int not null default 0,
  type text not null
    check (type in ('rich_text','video','map','file','quiz')),
  title text not null check (char_length(title) between 3 and 120),

  body_draft jsonb not null default '{}'::jsonb,
  body_published jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  draft_version int not null default 1,
  version int not null default 1,

  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================================
-- ESTUDIANTES
-- ============================================================

create table students (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text check (first_name is null or char_length(first_name) between 1 and 80),
  last_name text check (last_name is null or char_length(last_name) between 1 and 80),
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  email_verified_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 2000),

  is_anonymized boolean not null default false,
  anonymized_at timestamptz,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  status text not null default 'active'
    check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  unique(class_id, student_id)
);

create table student_email_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  purpose text not null default 'quiz_login'
    check (purpose in ('quiz_login','anonymization')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- QUIZZES
-- ============================================================

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null unique references contents(id) on delete cascade,
  instructions text check (instructions is null or char_length(instructions) <= 1000),
  max_score numeric not null default 100 check (max_score between 1 and 1000),
  passing_score numeric check (passing_score is null or passing_score >= 0),
  time_limit_min int check (time_limit_min is null or time_limit_min between 1 and 180),
  shuffle_questions boolean not null default false,
  show_correct_answers text not null default 'after_close'
    check (show_correct_answers in ('never','after_submit','after_close')),

  is_available boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  check (opens_at is null or closes_at is null or opens_at < closes_at),

  attempts_allowed int not null default 1 check (attempts_allowed between 1 and 5),
  attempt_scoring text not null default 'best'
    check (attempt_scoring in ('best','average')),

  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  order_index int not null default 0,
  points numeric not null default 1 check (points between 0.25 and 100),
  type text not null
    check (type in ('single_choice','multi_choice','true_false','short_answer','map_pin')),
  prompt text not null check (char_length(prompt) between 5 and 1000),
  body jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete set null,
  student_id uuid not null references students(id) on delete restrict,
  attempt_number int not null check (attempt_number >= 1),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  expires_at timestamptz,
  score numeric,
  max_score numeric,
  status text not null default 'in_progress'
    check (status in ('in_progress','submitted','graded','abandoned')),

  attempt_session_token_hash text not null,
  idempotency_key text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(quiz_id, student_id, attempt_number)
);

create table attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  original_question_id uuid references quiz_questions(id) on delete set null,
  order_index int not null,
  points numeric not null,
  type text not null
    check (type in ('single_choice','multi_choice','true_false','short_answer','map_pin')),
  prompt text not null,
  body_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(attempt_id, order_index)
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_id uuid not null references attempt_questions(id) on delete cascade,
  response jsonb not null default '{}'::jsonb,
  is_correct boolean,
  points_awarded numeric,
  feedback text check (feedback is null or char_length(feedback) <= 1000),
  client_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

create table attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  type text not null
    check (type in (
      'tab_blur', 'tab_focus',
      'paste', 'copy',
      'duplicate_instance_attempt',
      'time_expired',
      'reconnect',
      'submit_blocked'
    )),
  payload jsonb,
  occurred_at timestamptz not null default now()
);

-- ============================================================
-- GRADEBOOK
-- ============================================================

create table grade_categories (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  weight numeric not null check (weight between 0 and 100),
  order_index int not null default 0,
  deleted_at timestamptz
);

create table grade_items (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  category_id uuid not null references grade_categories(id) on delete cascade,
  quiz_id uuid references quizzes(id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  max_score numeric not null default 100,
  due_at timestamptz,
  missing_policy text not null default 'ignore_until_due'
    check (missing_policy in ('ignore_until_due','zero_immediately','ignore_always')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table grades (
  id uuid primary key default gen_random_uuid(),
  grade_item_id uuid not null references grade_items(id) on delete cascade,
  student_id uuid not null references students(id) on delete restrict,
  score numeric,
  notes text check (notes is null or char_length(notes) <= 1000),
  updated_at timestamptz not null default now(),
  unique(grade_item_id, student_id)
);

create table grade_audit_log (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid references grades(id) on delete cascade,
  old_score numeric,
  new_score numeric,
  reason text check (reason is null or char_length(reason) <= 1000),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

-- ============================================================
-- RATE LIMITING
-- ============================================================

create table rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  endpoint text not null,
  window_start timestamptz not null,
  count int not null default 1,
  unique(key, endpoint, window_start)
);

-- ============================================================
-- NOTIFICACIONES
-- ============================================================

create table notifications (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references auth.users(id) on delete cascade,
  type text not null
    check (type in (
      'new_attempt_submitted',
      'manual_review_needed',
      'quiz_window_closing',
      'module_opening_today',
      'student_milestone'
    )),
  title text not null,
  body text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- EVENTOS DE PRODUCTO
-- ============================================================

create table events (
  id uuid primary key default gen_random_uuid(),
  type text not null
    check (type in (
      'class_created',
      'module_created',
      'class_published',
      'student_session_started',
      'attempt_started',
      'attempt_submitted',
      'attempt_graded',
      'gradebook_viewed'
    )),
  actor_type text not null check (actor_type in ('professor', 'student', 'system')),
  actor_id uuid,
  metadata jsonb,
  occurred_at timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- Índices únicos parciales (requieren CREATE UNIQUE INDEX, no UNIQUE constraint en tabla)
create unique index idx_classes_slug_active on classes(slug) where deleted_at is null;
create unique index idx_modules_slug_active on modules(class_id, slug) where deleted_at is null;
create unique index idx_contents_slug_active on contents(module_id, slug) where deleted_at is null;
create unique index idx_students_email_active on students(email) where is_anonymized = false;
create unique index idx_attempts_idempotency on attempts(quiz_id, student_id, idempotency_key) where idempotency_key is not null;

create index idx_modules_class_order on modules(class_id, order_index) where deleted_at is null;
create index idx_contents_module_order on contents(module_id, order_index) where deleted_at is null;
create index idx_questions_quiz_order on quiz_questions(quiz_id, order_index);
create index idx_class_students_class on class_students(class_id, status);
create index idx_attempts_quiz_student on attempts(quiz_id, student_id);
create index idx_attempts_status on attempts(status) where status in ('in_progress','submitted');
create index idx_attempt_questions_attempt on attempt_questions(attempt_id, order_index);
create index idx_grades_student on grades(student_id);
create index idx_grade_items_class on grade_items(class_id) where deleted_at is null;
create index idx_grade_audit_grade on grade_audit_log(grade_id, changed_at desc);
create index idx_attempt_events_attempt on attempt_events(attempt_id, occurred_at);
create index idx_notifications_professor_unread on notifications(professor_id, created_at desc) where read_at is null;
create index idx_events_type_time on events(type, occurred_at desc);
create index idx_rate_limits_key_endpoint on rate_limits(key, endpoint, window_start desc);

-- ============================================================
-- TRIGGERS
-- ============================================================

create or replace function tg_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_classes_updated before update on classes
  for each row execute function tg_set_updated_at();
create trigger trg_modules_updated before update on modules
  for each row execute function tg_set_updated_at();
create trigger trg_contents_updated before update on contents
  for each row execute function tg_set_updated_at();
create trigger trg_quizzes_updated before update on quizzes
  for each row execute function tg_set_updated_at();
create trigger trg_quiz_questions_updated before update on quiz_questions
  for each row execute function tg_set_updated_at();
create trigger trg_attempts_updated before update on attempts
  for each row execute function tg_set_updated_at();
create trigger trg_answers_updated before update on answers
  for each row execute function tg_set_updated_at();
create trigger trg_grade_items_updated before update on grade_items
  for each row execute function tg_set_updated_at();
create trigger trg_grades_updated before update on grades
  for each row execute function tg_set_updated_at();

-- Auditoría de cambios de notas
create or replace function tg_grade_audit_log() returns trigger as $$
begin
  if old.score is distinct from new.score then
    insert into grade_audit_log (grade_id, old_score, new_score, changed_by)
    values (new.id, old.score, new.score, auth.uid());
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_grades_audit after update on grades
  for each row execute function tg_grade_audit_log();

-- ============================================================
-- RLS
-- ============================================================

alter table classes enable row level security;
alter table modules enable row level security;
alter table contents enable row level security;
alter table students enable row level security;
alter table class_students enable row level security;
alter table student_email_codes enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table attempts enable row level security;
alter table attempt_questions enable row level security;
alter table answers enable row level security;
alter table attempt_events enable row level security;
alter table grade_categories enable row level security;
alter table grade_items enable row level security;
alter table grades enable row level security;
alter table grade_audit_log enable row level security;
alter table rate_limits enable row level security;
alter table notifications enable row level security;
alter table events enable row level security;

-- Classes
create policy "public reads published classes"
  on classes for select
  using (is_published = true and deleted_at is null);

create policy "professor manages own classes"
  on classes for all
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

-- Modules
create policy "public reads visible modules metadata"
  on modules for select
  using (
    deleted_at is null
    and is_published = true
    and exists (
      select 1 from classes c
      where c.id = modules.class_id
        and c.is_published = true
        and c.deleted_at is null
    )
  );

create policy "professor manages own modules"
  on modules for all
  using (
    exists (
      select 1 from classes c
      where c.id = modules.class_id and c.professor_id = auth.uid()
    )
  );

-- Contents
create policy "public reads contents of available modules"
  on contents for select
  using (
    deleted_at is null
    and is_published = true
    and exists (
      select 1 from modules m
      join classes c on c.id = m.class_id
      where m.id = contents.module_id
        and m.deleted_at is null
        and m.is_published = true
        and m.is_available = true
        and (m.opens_at is null or now() >= m.opens_at)
        and (m.closes_at is null or now() <= m.closes_at)
        and c.is_published = true
        and c.deleted_at is null
    )
  );

create policy "professor manages own contents"
  on contents for all
  using (
    exists (
      select 1 from modules m
      join classes c on c.id = m.class_id
      where m.id = contents.module_id and c.professor_id = auth.uid()
    )
  );

-- Attempts: profesor lee los de sus clases
create policy "professor reads own class attempts"
  on attempts for select
  using (
    exists (
      select 1 from quizzes q
      join contents co on co.id = q.content_id
      join modules m on m.id = co.module_id
      join classes c on c.id = m.class_id
      where q.id = attempts.quiz_id and c.professor_id = auth.uid()
    )
  );

-- Notifications: solo el profesor dueño
create policy "professor reads own notifications"
  on notifications for all
  using (professor_id = auth.uid());

-- Grade categories/items/grades: solo el profesor dueño
create policy "professor manages grade_categories"
  on grade_categories for all
  using (
    exists (select 1 from classes c where c.id = grade_categories.class_id and c.professor_id = auth.uid())
  );

create policy "professor manages grade_items"
  on grade_items for all
  using (
    exists (select 1 from classes c where c.id = grade_items.class_id and c.professor_id = auth.uid())
  );

create policy "professor manages grades"
  on grades for all
  using (
    exists (
      select 1 from grade_items gi
      join classes c on c.id = gi.class_id
      where gi.id = grades.grade_item_id and c.professor_id = auth.uid()
    )
  );

-- ============================================================
-- VISTA PÚBLICA DE PREGUNTAS (sin respuestas correctas)
-- ============================================================

create view quiz_questions_public as
select
  id, quiz_id, order_index, points, type, prompt,
  case
    when type in ('single_choice','multi_choice') then
      jsonb_set(body, '{options}',
        (select jsonb_agg(opt - 'is_correct') from jsonb_array_elements(body->'options') as opt))
    when type = 'true_false' then body - 'correct' - 'explanation'
    when type = 'short_answer' then body - 'accepted_answers'
    when type = 'map_pin' then body - 'expected'
    else body
  end as body
from quiz_questions;

grant select on quiz_questions_public to anon, authenticated;
