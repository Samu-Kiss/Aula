-- ============================================================
-- Elimina la feature de anonimización de estudiantes.
-- El flujo de cara al usuario nunca se implementó; se retira
-- la infraestructura de soporte (columnas, check e índice parcial).
-- ============================================================

-- El índice único parcial de email dependía de is_anonymized;
-- se reemplaza por un único completo antes de soltar la columna.
drop index if exists idx_students_email_active;
create unique index idx_students_email_active on students(email);

alter table students
  drop column if exists is_anonymized,
  drop column if exists anonymized_at;

alter table student_email_codes
  drop constraint if exists student_email_codes_purpose_check;
alter table student_email_codes
  add constraint student_email_codes_purpose_check
    check (purpose = 'quiz_login');
