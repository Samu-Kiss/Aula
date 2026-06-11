-- ============================================================
-- F4-04: Comprehensive Row Level Security
-- All tables locked down; service role bypasses RLS by default.
-- ============================================================

-- Drop the policies from the initial schema that this migration supersedes
drop policy if exists "public reads published classes" on classes;
drop policy if exists "professor manages own classes" on classes;
drop policy if exists "public reads visible modules metadata" on modules;
drop policy if exists "professor manages own modules" on modules;
drop policy if exists "public reads contents of available modules" on contents;
drop policy if exists "professor manages own contents" on contents;
drop policy if exists "professor reads own class attempts" on attempts;
drop policy if exists "professor reads own notifications" on notifications;
drop policy if exists "professor manages grade_categories" on grade_categories;
drop policy if exists "professor manages grade_items" on grade_items;
drop policy if exists "professor manages grades" on grades;

-- Enable RLS on all tables that don't have it yet
alter table classes enable row level security;
alter table modules enable row level security;
alter table contents enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table students enable row level security;
alter table class_students enable row level security;
alter table student_email_codes enable row level security;
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

-- ============================================================
-- CLASSES
-- ============================================================

create policy "professors manage own classes"
  on classes for all
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

create policy "public reads published classes"
  on classes for select
  using (is_published = true and deleted_at is null);

-- ============================================================
-- MODULES
-- ============================================================

create policy "professors manage modules in own classes"
  on modules for all
  using (
    exists (
      select 1 from classes c
      where c.id = modules.class_id and c.professor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from classes c
      where c.id = modules.class_id and c.professor_id = auth.uid()
    )
  );

create policy "public reads published modules in published classes"
  on modules for select
  using (
    is_published = true
    and deleted_at is null
    and exists (
      select 1 from classes c
      where c.id = modules.class_id
        and c.is_published = true
        and c.deleted_at is null
    )
  );

-- ============================================================
-- CONTENTS
-- ============================================================

create policy "professors manage contents in own modules"
  on contents for all
  using (
    exists (
      select 1 from modules m
      join classes c on c.id = m.class_id
      where m.id = contents.module_id and c.professor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from modules m
      join classes c on c.id = m.class_id
      where m.id = contents.module_id and c.professor_id = auth.uid()
    )
  );

create policy "public reads published contents in published modules"
  on contents for select
  using (
    is_published = true
    and deleted_at is null
    and exists (
      select 1 from modules m
      join classes c on c.id = m.class_id
      where m.id = contents.module_id
        and m.is_published = true
        and m.deleted_at is null
        and c.is_published = true
        and c.deleted_at is null
    )
  );

-- ============================================================
-- STUDENTS — service role only (all student routes use service client)
-- No public or professor-level direct access via RLS
-- ============================================================

-- (No policies created; service role bypasses RLS)

-- ============================================================
-- CLASS_STUDENTS — professors can read their own class roster
-- ============================================================

create policy "professors read own class roster"
  on class_students for select
  using (
    exists (
      select 1 from classes c
      where c.id = class_students.class_id and c.professor_id = auth.uid()
    )
  );

-- ============================================================
-- STUDENT_EMAIL_CODES — service role only
-- ============================================================

-- (No policies; service role manages all code operations)

-- ============================================================
-- ATTEMPTS, ATTEMPT_QUESTIONS, ANSWERS, ATTEMPT_EVENTS
-- All managed via service role only (all routes use createServiceClient)
-- Professors can read attempts for their quizzes
-- ============================================================

create policy "professors read attempts for own quizzes"
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

create policy "professors read attempt_questions for own quizzes"
  on attempt_questions for select
  using (
    exists (
      select 1 from attempts a
      join quizzes q on q.id = a.quiz_id
      join contents co on co.id = q.content_id
      join modules m on m.id = co.module_id
      join classes c on c.id = m.class_id
      where a.id = attempt_questions.attempt_id and c.professor_id = auth.uid()
    )
  );

create policy "professors read answers for own quizzes"
  on answers for select
  using (
    exists (
      select 1 from attempt_questions aq
      join attempts a on a.id = aq.attempt_id
      join quizzes q on q.id = a.quiz_id
      join contents co on co.id = q.content_id
      join modules m on m.id = co.module_id
      join classes c on c.id = m.class_id
      where aq.id = answers.question_id and c.professor_id = auth.uid()
    )
  );

create policy "professors read events for own quizzes"
  on attempt_events for select
  using (
    exists (
      select 1 from attempts a
      join quizzes q on q.id = a.quiz_id
      join contents co on co.id = q.content_id
      join modules m on m.id = co.module_id
      join classes c on c.id = m.class_id
      where a.id = attempt_events.attempt_id and c.professor_id = auth.uid()
    )
  );

-- ============================================================
-- GRADE_CATEGORIES, GRADE_ITEMS, GRADES, GRADE_AUDIT_LOG
-- ============================================================

create policy "professors manage grade_categories in own classes"
  on grade_categories for all
  using (
    exists (
      select 1 from classes c
      where c.id = grade_categories.class_id and c.professor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from classes c
      where c.id = grade_categories.class_id and c.professor_id = auth.uid()
    )
  );

create policy "professors manage grade_items in own classes"
  on grade_items for all
  using (
    exists (
      select 1 from classes c
      where c.id = grade_items.class_id and c.professor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from classes c
      where c.id = grade_items.class_id and c.professor_id = auth.uid()
    )
  );

create policy "professors manage grades in own classes"
  on grades for all
  using (
    exists (
      select 1 from grade_items gi
      join classes c on c.id = gi.class_id
      where gi.id = grades.grade_item_id and c.professor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from grade_items gi
      join classes c on c.id = gi.class_id
      where gi.id = grades.grade_item_id and c.professor_id = auth.uid()
    )
  );

create policy "professors read grade_audit_log in own classes"
  on grade_audit_log for select
  using (
    exists (
      select 1 from grades g
      join grade_items gi on gi.id = g.grade_item_id
      join classes c on c.id = gi.class_id
      where g.id = grade_audit_log.grade_id and c.professor_id = auth.uid()
    )
  );

-- ============================================================
-- RATE_LIMITS — service role only
-- ============================================================

-- (No policies; managed exclusively via service role)

-- ============================================================
-- NOTIFICATIONS — professors read their own
-- ============================================================

create policy "professors read own notifications"
  on notifications for all
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());
