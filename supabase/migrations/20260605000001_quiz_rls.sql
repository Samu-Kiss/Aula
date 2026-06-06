-- RLS policies for quizzes and quiz_questions (omitted from initial migration)

-- Quizzes: professor manages quizzes for their own contents
create policy "professor manages own quizzes"
  on quizzes for all
  using (
    exists (
      select 1 from contents co
      join modules m on m.id = co.module_id
      join classes c on c.id = m.class_id
      where co.id = quizzes.content_id and c.professor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from contents co
      join modules m on m.id = co.module_id
      join classes c on c.id = m.class_id
      where co.id = quizzes.content_id and c.professor_id = auth.uid()
    )
  );

-- Quizzes: public can read available quizzes (for student quiz view)
create policy "public reads available quizzes"
  on quizzes for select
  using (
    deleted_at is null
    and is_available = true
    and (opens_at is null or now() >= opens_at)
    and (closes_at is null or now() <= closes_at)
    and exists (
      select 1 from contents co
      join modules m on m.id = co.module_id
      join classes c on c.id = m.class_id
      where co.id = quizzes.content_id
        and co.deleted_at is null
        and co.is_published = true
        and m.deleted_at is null
        and m.is_published = true
        and c.is_published = true
        and c.deleted_at is null
    )
  );

-- Quiz questions: professor manages questions for their own quizzes
create policy "professor manages own quiz_questions"
  on quiz_questions for all
  using (
    exists (
      select 1 from quizzes q
      join contents co on co.id = q.content_id
      join modules m on m.id = co.module_id
      join classes c on c.id = m.class_id
      where q.id = quiz_questions.quiz_id and c.professor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from quizzes q
      join contents co on co.id = q.content_id
      join modules m on m.id = co.module_id
      join classes c on c.id = m.class_id
      where q.id = quiz_questions.quiz_id and c.professor_id = auth.uid()
    )
  );

-- Quiz questions: public can read via the quiz_questions_public view (already granted)
-- Direct table read for students during attempts (via attempt_questions join) is handled
-- by the service role key in attempt routes.
