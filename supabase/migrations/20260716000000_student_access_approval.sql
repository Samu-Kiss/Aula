-- Aprobación de acceso de estudiantes:
-- los auto-registros quedan 'pending' hasta que el profesor los apruebe.
alter table class_students drop constraint class_students_status_check;
alter table class_students add constraint class_students_status_check
  check (status in ('pending', 'active', 'inactive'));

-- Notificación al profesor cuando un estudiante solicita acceso a su clase.
alter table professor_notifications drop constraint professor_notifications_type_check;
alter table professor_notifications add constraint professor_notifications_type_check
  check (type in ('attempt_submitted', 'access_request'));
