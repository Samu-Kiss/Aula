-- Linter de Supabase (crítico): quiz_questions_public se creó sin opciones,
-- lo que en Postgres equivale a SECURITY DEFINER — la vista se ejecutaba con
-- los permisos de su creador (postgres) y se saltaba el RLS del consultante.
--
-- La app no consume esta vista desde el cliente: el flujo de intentos
-- snapshotea las preguntas server-side con el service role y las sanitiza en
-- src/lib/domain/quiz.ts (sanitizeQuestionForPublic). Se recrea como
-- security_invoker (el RLS que aplica es el del usuario que consulta) y se
-- revoca el acceso de anon, que no la necesita.
--
-- De paso se corrige el sanitizado de map_pin: el campo que contiene la
-- respuesta correcta es correct_marker_id ('expected' no existe en el schema
-- actual de body, quedaba expuesto).

create or replace view public.quiz_questions_public
with (security_invoker = on) as
select
  id, quiz_id, order_index, points, type, prompt,
  case
    when type in ('single_choice','multi_choice') then
      jsonb_set(body, '{options}',
        (select jsonb_agg(opt - 'is_correct') from jsonb_array_elements(body->'options') as opt))
    when type = 'true_false' then body - 'correct' - 'explanation'
    when type = 'short_answer' then body - 'accepted_answers'
    when type = 'map_pin' then body - 'correct_marker_id' - 'expected'
    else body
  end as body
from quiz_questions;

revoke select on public.quiz_questions_public from anon;
