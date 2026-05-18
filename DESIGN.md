# Plataforma de Clases para Profesor — Documento de Diseño y Arquitectura

**Autor:** Samuel
**Fecha:** Mayo 2026
**Estado:** Diseño detallado, listo para implementación.

---

# Parte I — Producto

## 1. Visión general

Plataforma web que permite a un único profesor crear, organizar y publicar contenidos didácticos agrupados por clases, cada una con su propio endpoint público. Cada clase contiene módulos, y cada módulo contiene contenidos: textos enriquecidos, videos embebidos, mapas interactivos, archivos y evaluaciones.

Los estudiantes acceden sin registrarse, identificándose con su correo únicamente al presentar quizzes. El profesor cuenta con un dashboard donde gestiona contenido, controla la disponibilidad de módulos y evaluaciones, califica intentos y administra un gradebook con categorías y pesos.

### 1.1 Objetivos

- Catálogo de clases estructuradas por módulos y contenidos.
- URL pública única por clase con identidad visual propia.
- Contenido multimedia: texto rico, video, mapas, archivos, quizzes.
- Evaluaciones con identificación mínima del estudiante (solo correo).
- Habilitar/deshabilitar disponibilidad de módulos y evaluaciones manual o programada.
- Gradebook con categorías ponderadas y notas manuales o automáticas.
- Soporte a dispositivos compartidos mediante sesión explícita.
- Lenguaje visual coherente desde la UI hasta los mapas, con identidad por clase.
- Anti-cheating mínimo durante quizzes.
- Web responsiva (móvil, tablet, escritorio).
- WCAG 2.1 AA.

### 1.2 No-objetivos del MVP

- Multi-tenant: un solo profesor.
- Autenticación con contraseña para estudiantes.
- Foros o mensajería bidireccional.
- Pagos o suscripciones.
- App móvil nativa.

---

## 2. Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React 19 | SSR para rutas públicas, RSC + Server Actions para dashboard. |
| Estilos | Tailwind CSS | Velocidad, consistencia. |
| Validación | Zod | Schemas compartidos cliente/servidor. |
| Tipografía sans | Inter Display o General Sans | Pesos 400–900 reales. |
| Tipografía serif | Fraunces o PP Editorial New | Italic con personalidad. |
| Tipografía mono | JetBrains Mono | Metadata, URLs, código. |
| Base de datos | PostgreSQL (Supabase) | Relacional, `jsonb`, RLS, PITR. |
| Auth profesor | Supabase Auth | Sesión integrada con RLS. |
| Auth estudiante | JWT firmado en cookie httpOnly | Sin registro, soporta dispositivos compartidos. |
| Storage | Cloudflare R2 | S3-compatible, CDN nativo, sin egress fees. |
| Email transaccional | Resend | Buen DX, plantillas React. |
| Editor de texto | Tiptap | Estilo Notion, extensible, JSON serializable. |
| Mapas | Mapbox GL JS | Estilo custom alineado al lenguaje visual. |
| Drag & drop | dnd-kit | Reordenamiento de módulos y contenidos. |
| Observabilidad | Sentry + Vercel Analytics | Errores + web vitals. |
| Testing | Vitest (unit/integration) + Playwright (E2E) | Stack de testing moderno y rápido. |
| Hosting | Vercel | Integración nativa con Next.js. |

---

## 3. Arquitectura general

```
┌─────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR                              │
│  ┌──────────────────────┐         ┌──────────────────────┐      │
│  │ Profesor (auth)      │         │ Estudiante (cookie)  │      │
│  └──────────┬───────────┘         └──────────┬───────────┘      │
└─────────────┼─────────────────────────────────┼─────────────────┘
              │                                 │
              ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NEXT.JS (Vercel)                           │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐   │
│  │ Server       │ │ Route        │ │ Server Actions         │   │
│  │ Components   │ │ Handlers     │ │ (mutaciones dashboard) │   │
│  └──────┬───────┘ └──────┬───────┘ └───────────┬────────────┘   │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│   SUPABASE     │ │   CLOUDFLARE R2 │ │   RESEND  + SENTRY  │
│ Postgres + RLS │ │ Buckets + CDN   │ │ Email + Errores     │
│ Auth (profe)   │ │ Pub/Priv        │ │                     │
└────────────────┘ └─────────────────┘ └─────────────────────┘
```

### 3.1 Separación de responsabilidades

**Rutas públicas (`/c/*`)**: Server Components con consultas via Supabase con clave anónima sujeta a RLS. Caché agresivo, SEO bloqueado (ver §23).

**Dashboard (`/dashboard/*`)**: mezcla RSC (listados) y Client Components (editor, drag & drop). Mutaciones via Server Actions con validación Zod.

**Submits de estudiante**: siempre via Route Handlers (`/api/student/*`, `/api/attempts/*`). Validan JWT, aplican lógica server-side (auto-calificación, anti-cheating), persisten.

**Cron jobs** (Vercel Cron): backup semanal a R2, limpieza de drafts huérfanos, recalculo nocturno de grades agregados, hard delete de soft-deletes expirados.

---

# Parte II — Datos y dominio

## 4. Modelo de datos

### 4.1 Diagrama de entidades

```
classes ─< modules ─< contents ── quizzes ─< quiz_questions
   │           │            │          │
   │           │            │          └─< attempts ─< attempt_questions ─< answers
   │           │            │                         │
   │           │            │                         └─< attempt_events
   │           │            │
   │           │            └─ content slugs públicos por módulo
   │           │
   └─< class_students >─ students ─< attempts
                         students ─< grades

grade_categories ─< grade_items ─< grades ─< grade_audit_log
grade_items ─< quizzes (opcional, FK)
```

**Nota de dominio:** `students` representa la identidad mínima global por correo, mientras que `class_students` representa la pertenencia de un estudiante a una clase específica. El gradebook debe basarse en `class_students` para poder mostrar roster antes de que existan intentos o calificaciones.

### 4.2 Esquema SQL completo

```sql
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

  -- Identidad visual
  accent text not null default 'indigo'
    check (accent in ('indigo','terracota','bosque','ciruela','ambar','pizarra','borgona','salvia')),
  lockup_split_at int check (lockup_split_at is null or lockup_split_at >= 1),

  visibility text not null default 'unlisted'
    check (visibility in ('public','unlisted')),
  is_published boolean not null default false,

  -- Escala de calificación por clase
  grade_scale text not null default 'percent'
    check (grade_scale in ('percent','five_point')),
  grade_min numeric not null default 0,
  grade_max numeric not null default 100,
  passing_grade numeric,
  check (grade_min < grade_max),
  check (passing_grade is null or (passing_grade >= grade_min and passing_grade <= grade_max)),

  -- Concurrencia optimista
  version int not null default 1,

  -- Auditoría y soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (slug) where deleted_at is null
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  slug text not null,
  order_index int not null default 0,
  title text not null check (char_length(title) between 3 and 80),
  description text check (description is null or char_length(description) <= 500),
  is_published boolean not null default false,

  -- Disponibilidad
  is_available boolean not null default true,
  opens_at timestamptz,
  closes_at timestamptz,
  check (opens_at is null or closes_at is null or opens_at < closes_at),

  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (class_id, slug) where deleted_at is null
);

create table contents (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  slug text not null,
  order_index int not null default 0,
  type text not null
    check (type in ('rich_text','video','map','file','quiz')),
  title text not null check (char_length(title) between 3 and 120),

  -- CMS: separar borrador de publicado evita que el autosave afecte lo público.
  body_draft jsonb not null default '{}'::jsonb,
  body_published jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  draft_version int not null default 1,
  version int not null default 1,

  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (module_id, slug) where deleted_at is null
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

  -- Anonimización (right to be forgotten)
  is_anonymized boolean not null default false,
  anonymized_at timestamptz,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  unique (email) where is_anonymized = false
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
  expires_at timestamptz,                       -- = started_at + time_limit_min, null si sin límite
  score numeric,
  max_score numeric,
  status text not null default 'in_progress'
    check (status in ('in_progress','submitted','graded','abandoned')),

  -- Para detectar instancias paralelas del intento.
  -- Guardar hash, no token plano.
  attempt_session_token_hash text not null,
  idempotency_key text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(quiz_id, student_id, attempt_number),
  unique(quiz_id, student_id, idempotency_key) where idempotency_key is not null
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

-- Eventos del intento (anti-cheating, auditoría)
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
-- RATE LIMITING SIMPLE (MVP)
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
-- NOTIFICACIONES (in-app, profesor)
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
-- EVENTOS DE PRODUCTO (analytics interno)
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
```

### 4.3 Triggers automáticos

```sql
-- updated_at automático en todas las tablas con esa columna
create or replace function tg_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_classes_updated before update on classes
  for each row execute function tg_set_updated_at();
-- (repetir para modules, contents, quizzes, quiz_questions, attempts, answers, grade_items, grades)

-- Incrementar version solo cuando se publica/guarda explícitamente.
-- El autosave modifica body_draft y draft_version, pero no version pública.
create or replace function tg_increment_version() returns trigger as $$
begin
  new.version = old.version + 1;
  return new;
end;
$$ language plpgsql;

create trigger trg_classes_version before update on classes
  for each row execute function tg_increment_version();
-- (repetir para modules, contents, quizzes en operaciones de guardado explícito)

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
```

### 4.4 Estructura de `body_draft` y `body_published` por tipo

Los contenidos usan dos columnas `jsonb`: `body_draft` para edición/autosave y `body_published` para lo visible públicamente. El botón **Publicar cambios** copia `body_draft` a `body_published`, actualiza `published_at` e incrementa `version`. Esto evita que el autosave del profesor cambie contenido público sin intención.

La forma del JSON depende del campo `type`:

**`rich_text`**
```json
{ "doc": { /* Tiptap JSON document */ } }
```

**`video`**
```json
{ "provider": "youtube", "videoId": "dQw4w9WgXcQ", "startAt": 0 }
```

**`map`**
```json
{
  "center": [-74.08, 4.61],
  "zoom": 12,
  "style": "mapbox://styles/aula/custom",
  "markers": [
    { "lng": -74.08, "lat": 4.61, "title": "Punto A", "description": "..." }
  ],
  "geojson": null
}
```

El estilo de Mapbox referenciado es un estilo personalizado de la plataforma alineado con la paleta neutra. Los markers se renderizan en el color de acento de la clase (ver §19.8).

**`file`**
```json
{
  "storage_path": "abc-123/modulo-1/lectura.pdf",
  "mime": "application/pdf",
  "size": 248576,
  "original_name": "Lectura semana 1.pdf"
}
```

**`quiz`**
```json
{}
```

El contenido tipo `quiz` no guarda `quiz_id` en el JSON para evitar redundancia. La relación oficial vive únicamente en `quizzes.content_id`; el backend busca el quiz por `content_id` cuando renderiza `/c/[classSlug]/[moduleSlug]/[contentSlug]`.

### 4.5 Estructura del campo `quiz_questions.body` por tipo

**`single_choice` / `multi_choice`**
```json
{
  "options": [
    { "id": "a", "text": "Opción A", "is_correct": true },
    { "id": "b", "text": "Opción B", "is_correct": false }
  ],
  "explanation": "Opcional, se muestra según política"
}
```

**`true_false`**
```json
{ "correct": true, "explanation": "..." }
```

**`short_answer`**
```json
{
  "accepted_answers": ["Bogotá", "bogota"],
  "case_sensitive": false,
  "auto_grade": true
}
```

Si `auto_grade` es `false`, la respuesta queda con `is_correct = null` y entra a la cola de revisión manual.

**`map_pin`**
```json
{
  "base_map": { "center": [-74.08, 4.61], "zoom": 10, "style": "..." },
  "expected": { "lng": -74.08, "lat": 4.61 },
  "tolerance_km": 5
}
```

---

## 5. Identificación y sesión

### 5.1 Profesor

Autenticación estándar de Supabase Auth (email + contraseña). La sesión se maneja con la cookie estándar de Supabase. RLS amarra cada `class.professor_id` con `auth.uid()`.

### 5.2 Estudiante

El estudiante no tiene cuenta con contraseña. Para quizzes de práctica o bajo riesgo, el profesor puede permitir identificación simple. Para quizzes que alimentan calificaciones reales, el flujo recomendado exige correo, nombres y apellidos, más verificación por código de 6 dígitos enviado al correo.

```
┌─────────────────────────────────────┐
│  Confirma tu identidad              │
│                                     │
│  Nombre        [_________________]  │
│  Apellido      [_________________]  │
│  Correo        [_________________]  │
│                                     │
│             [ Enviar código ]       │
└─────────────────────────────────────┘
```

**Flujo de identificación para quizzes calificables:**

1. El estudiante ingresa nombre, apellido y correo.
2. El backend genera un código de 6 dígitos, guarda solo su hash en `student_email_codes` y lo envía por Resend.
3. El estudiante introduce el código dentro de la ventana de expiración.
4. El backend valida el código, hace `upsert` en `students`, actualiza `last_seen_at` y `email_verified_at`.
5. Si el estudiante entra a una clase por primera vez, se crea o reactiva la fila en `class_students`.
6. Se emite un JWT firmado con `{ student_id, email, iat }` y se setea como cookie httpOnly.
7. Al iniciar un intento, se genera un `attempt_session_token` específico para ese intento. En DB se guarda solo `attempt_session_token_hash`.

**Comportamiento de la cookie:**

| Modo | Atributos | Vida útil |
|---|---|---|
| Sin "Recordarme" | `HttpOnly; SameSite=Lax; Secure` (sin `Max-Age`) | Hasta cerrar el navegador |
| Con "Recordarme" | `HttpOnly; SameSite=Lax; Secure; Max-Age=2592000` | 30 días |

**Cambio de identidad:** En el header de cualquier vista de quiz se muestra el correo activo con un botón "No soy yo / Cambiar correo" que limpia la cookie y solicita una nueva verificación.

**Seguridad:** El JWT firmado evita manipulación del `student_id`, pero no basta para impedir suplantación si el correo no se verifica. Por eso, para notas reales, el código de correo es obligatorio. El token de intento es separado del JWT general para evitar confusión entre varios quizzes o intentos en el mismo navegador.

---

## 6. Disponibilidad de contenido---

## 6. Disponibilidad de contenido

La plataforma controla la disponibilidad de **módulos** y **quizzes** con el mismo modelo, lo que da al profesor un vocabulario consistente para secuenciar el curso.

### 6.1 Modelo común

Tres campos en cada tabla (`modules` y `quizzes`):

- **`is_available`** (boolean, default `true` en módulos, `false` en quizzes): toggle maestro. Si está apagado, el contenido queda bloqueado independientemente de las fechas.
- **`opens_at`** (timestamptz, nullable): inicio de la ventana. Si es `null`, no hay restricción de apertura.
- **`closes_at`** (timestamptz, nullable): fin de la ventana. Si es `null`, queda abierto indefinidamente.

### 6.2 Regla de visibilidad efectiva

Tanto módulos como quizzes usan la misma fórmula:

```
visible = is_published
          AND is_available
          AND (opens_at IS NULL OR now() >= opens_at)
          AND (closes_at IS NULL OR now() <= closes_at)
```

### 6.3 Estados resultantes para el estudiante

**Módulos:**

| Estado | Condición | Comportamiento |
|---|---|---|
| Borrador | `is_published = false` | Invisible. No aparece en la landing pública. |
| Programado | Publicado, disponible, antes de `opens_at` | Aparece en la lista con candado y fecha de apertura. Genera anticipación. |
| Disponible | Cumple todas las condiciones | El estudiante puede entrar y consumir el contenido. |
| Cerrado | Publicado, después de `closes_at` | Aparece deshabilitado con texto "cerró el [fecha]". |
| Bloqueado | `is_available = false` (toggle off) | Aparece deshabilitado con candado. Sin fecha. |

**Quizzes:** mismos estados, pero "no disponible" muestra el contenido del módulo bloqueando solo el quiz.

### 6.4 Indicadores en el dashboard

En el sidebar del editor de clase, cada módulo lleva un mini-ícono que delata su estado de un vistazo sin tener que abrir cada uno:

- ✓ Check verde: disponible
- ⏱ Reloj ámbar: programado (futuro `opens_at`)
- 🔒 Candado gris: bloqueado por toggle off o cerrado
- ✎ Lápiz gris: borrador

El profesor puede abrir un drawer de configuración por módulo desde el sidebar para ajustar `is_published`, `is_available`, `opens_at` y `closes_at` sin perder el contexto del editor.

### 6.5 Política de gracia al cerrar

Si un estudiante tiene un `attempt` con `status='in_progress'` cuando `closes_at` pasa, se permite finalizar el intento dentro de un margen de **15 minutos** después del cierre. Esto evita penalizar a quien ya estaba presentando el examen.

---

## 7. Sistema de calificaciones

### 7.1 Modelo conceptual

El gradebook se organiza en cuatro niveles:

1. **Roster de clase** (`class_students`): estudiantes inscritos o importados para una clase. Permite ver estudiantes aunque todavía no hayan respondido quizzes.
2. **Categorías** (`grade_categories`): agrupaciones con peso (ej. "Quizzes" 40%, "Participación" 20%, "Trabajos" 40%). La suma de pesos debe ser 100, validado en la UI.
3. **Items** (`grade_items`): entradas calificables dentro de una categoría. Pueden estar ligadas a un `quiz_id` (auto-poblado) o ser manuales (`quiz_id = null`).
4. **Calificaciones** (`grades`): el puntaje específico de un estudiante en un item, con auditoría en `grade_audit_log`.

Cada clase define su escala con `grade_scale`, `grade_min`, `grade_max` y `passing_grade`. El MVP puede trabajar internamente en porcentaje, pero el modelo deja lista la conversión a escala 0–5 si se necesita.

### 7.2 Auto-población desde quizzes

Cuando un estudiante hace submit de un quiz:

1. Se evalúan automáticamente las preguntas de tipo `single_choice`, `multi_choice`, `true_false`, `short_answer` (si `auto_grade=true`) y `map_pin`.
2. Las preguntas con `auto_grade=false` quedan con `is_correct=null` y el `attempt.status='submitted'` (no `'graded'`).
3. Si todas las preguntas son auto-calificables, el `attempt` pasa a `'graded'` directamente.
4. Cuando un intento queda en `'graded'`, se inserta o actualiza el registro en `grades` correspondiente al `grade_item` ligado al quiz.

**Política de intentos múltiples:** si el quiz permite varios intentos (`attempts_allowed > 1`), el `grades.score` se calcula según `attempt_scoring`:

- `best`: el puntaje más alto entre todos los intentos graded.
- `average`: el promedio de los intentos graded.

### 7.3 Cálculo de la nota final

```
nota_final = Σ (promedio_categoría_i × peso_i / 100)

promedio_categoría_i = promedio de (score / max_score × 100)
                       de todos los grade_items de esa categoría
```

**Items sin entregar:**

- En quizzes, cuentan como **0** cuando el quiz o su `grade_item.due_at` ya cerró. Antes de esa fecha se ignoran del promedio.
- En items manuales, se usa `grade_items.due_at` y `missing_policy`:
  - `ignore_until_due`: ignora el item hasta la fecha límite y luego cuenta 0 si no hay nota.
  - `zero_immediately`: cuenta 0 desde que se crea el item.
  - `ignore_always`: no penaliza ausencias; solo promedia notas existentes.

**Auditoría:** cada cambio manual de nota genera una fila en `grade_audit_log` con puntaje anterior, nuevo puntaje, usuario que cambió y fecha. La UI debe permitir agregar una razón cuando el profesor modifique una nota.

### 7.4 Revisión manual

El profesor accede a `/dashboard/clases/[id]/intentos` para ver una cola de intentos con preguntas pendientes. Por cada intento:

- Ve las respuestas del estudiante una por una.
- Asigna puntos a las preguntas con `is_correct=null`.
- Opcionalmente agrega feedback por pregunta.
- Al guardar, el sistema recalcula `attempt.score` y marca `status='graded'`.

---

## 8. Mapa de rutas

### 8.1 Públicas (sin auth)

| Ruta | Descripción |
|---|---|
| `/c/[classSlug]` | Landing de clase |
| `/c/[classSlug]/[moduleSlug]` | Módulo |
| `/c/[classSlug]/[moduleSlug]/[contentSlug]` | Contenido |
| `/privacidad` | Política de privacidad |
| `/privacidad/eliminar` | Solicitar eliminación de datos |
| `/404`, `/500` | Errores |

### 8.2 Dashboard (auth profesor)

| Ruta | Descripción |
|---|---|
| `/login` | Login |
| `/dashboard` | Lista de clases + notificaciones |
| `/dashboard/clases/nueva` | Crear clase |
| `/dashboard/clases/[id]` | Editor de clase |
| `/dashboard/clases/[id]/preview` | Vista previa real como estudiante/profesor |
| `/dashboard/clases/[id]/configuracion` | Slug, visibilidad, acento, publicación |
| `/dashboard/clases/[id]/quizzes` | Lista de quizzes |
| `/dashboard/clases/[id]/calificaciones` | Gradebook |
| `/dashboard/clases/[id]/calificaciones/categorias` | Pesos |
| `/dashboard/clases/[id]/intentos` | Cola de revisión |
| `/dashboard/clases/[id]/intentos/[attemptId]` | Revisar intento (incluye eventos anti-cheating) |
| `/dashboard/clases/[id]/estudiantes` | Roster e importación de estudiantes |
| `/dashboard/notificaciones` | Centro de notificaciones |
| `/dashboard/archivo` | Clases, módulos y contenidos eliminados (recuperables 30 días) |
| `/dashboard/admin` | Panel de admin (ver §17) |

### 8.3 API / Route Handlers

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/classes` | POST | Crear |
| `/api/classes/[id]` | PATCH, DELETE | Actualizar (con `version`), borrar (soft) |
| `/api/modules` | POST | Crear |
| `/api/modules/[id]` | PATCH, DELETE | Actualizar, borrar |
| `/api/modules/[id]/availability` | POST | Toggle + ventana |
| `/api/modules/reorder` | POST | Reordenar |
| `/api/contents` | POST | Crear |
| `/api/contents/[id]` | PATCH, DELETE | Actualizar, borrar |
| `/api/contents/[id]/autosave` | POST | Auto-guardado de body |
| `/api/quizzes/[id]` | PATCH | Actualizar |
| `/api/quizzes/[id]/availability` | POST | Toggle + ventana |
| `/api/quizzes/[id]/attempts` | POST | Iniciar intento (estudiante) |
| `/api/attempts/[id]/answers/batch` | PATCH | Auto-guardar respuestas en lote (debounced) |
| `/api/attempts/[id]/events` | POST | Registrar evento anti-cheating |
| `/api/attempts/[id]/submit` | POST | Enviar intento |
| `/api/attempts/[id]/grade` | POST | Calificar manualmente |
| `/api/student/session` | POST | Solicitar código de verificación por email |
| `/api/student/session/verify` | POST | Verificar código y emitir JWT de estudiante |
| `/api/student/session` | DELETE | Cerrar sesión |
| `/api/student/anonymize` | POST | Solicitar anonimización |
| `/api/uploads/sign` | POST | URL firmada para R2 |
| `/api/classes/[id]/students/import` | POST | Importar roster CSV |
| `/api/classes/[id]/grades/export` | GET | Exportar calificaciones CSV |
| `/api/notifications` | GET | Lista del profesor |
| `/api/notifications/[id]/read` | POST | Marcar leída |

---

# Parte III — Calidad y operación

## 9. Mecánica del quiz

Esta sección define los flujos críticos del intento: cómo corre el tiempo, cómo se auto-guardan las respuestas, qué pasa con desconexiones, y cómo opera el anti-cheating.

### 9.1 Tiempo del quiz

**Configuración:** `quizzes.time_limit_min` (nullable, 1–180 min).

**Modelo authoritative del servidor:**

1. Al iniciar: `attempts.started_at = now()`, `attempts.expires_at = now() + interval (time_limit_min * 60) seconds` (o `null` si sin límite).
2. El cliente computa el contador en pantalla a partir de `expires_at - now()`.
3. Al hacer submit, el servidor valida que `now() <= expires_at + interval '30 seconds'` (margen de gracia para latencia). Si excede, rechaza con error `422 time_expired`.
4. Auto-submit del cliente: cuando el reloj llega a 0, dispara submit automático con las respuestas guardadas.
5. Cron job nocturno: marca como `abandoned` los intentos `in_progress` cuyo `expires_at + 1 hour < now()`.

**Alertas en pantalla:** notificación a los 5 min, 1 min y 30s restantes (banner no intrusivo).

### 9.2 Flujos alternos de tiempo

| Situación | Comportamiento |
|---|---|
| Estudiante recarga la página | El cliente re-fetcha `attempts.expires_at` del servidor y recalcula el contador. El tiempo no se pausa. |
| Estudiante pierde conexión | El cliente detecta offline (navigator.onLine + ping al servidor cada 30s), muestra banner "Sin conexión, tu tiempo sigue corriendo". Las respuestas escritas durante offline se guardan en `localStorage`, sync al recuperar conexión. |
| Estudiante cierra el navegador | El intento queda `in_progress` con su `expires_at` original. Al volver a entrar al quiz, se le ofrece "Tienes un intento en curso, ¿continuar?" |
| Tiempo expira mientras está offline | Al reconectar, el cliente detecta `expires_at < now()`, fuerza el submit con las respuestas locales. El servidor acepta dentro de los 30s de gracia o rechaza. |
| El profe extiende el tiempo después de iniciado | El profe puede modificar `time_limit_min` del quiz, pero solo afecta a intentos futuros. Los intentos en curso mantienen su `expires_at` original. |

### 9.3 Auto-guardado

**Para el estudiante (durante un intento):**

- Cada cambio en una respuesta se guarda con debounce de **1.5–2 segundos**.
- El cliente solo envía cambios cuando el valor realmente cambió.
- Las respuestas se envían en lote a `PATCH /api/attempts/[id]/answers/batch`, no una por una.
- Payload sugerido:

```json
{
  "answers": [
    { "question_id": "uuid-de-attempt-question", "response": {}, "client_updated_at": "2026-05-01T12:00:00.000Z" }
  ]
}
```

- El cliente mantiene un "draft local" en `localStorage` por intento, indexado por `attempt_id`, que se sincroniza al recuperar conexión.
- `localStorage` se trata como cache no confiable: el servidor siempre valida intento activo, tiempo vigente, pertenencia de la pregunta al intento, formato de respuesta y nunca acepta `points` ni `is_correct` desde el cliente.
- Indicador visible: "Guardado" / "Guardando..." / "Sin guardar" en el header del quiz.

**Para el profesor (editando una clase):**

- Editor Tiptap del contenido `rich_text`: auto-guardado cada **5 segundos** a `/api/contents/[id]/autosave`, actualizando `body_draft` y `draft_version` sin tocar `body_published` ni incrementar `version`.
- Botón "Publicar cambios" copia `body_draft` a `body_published`, actualiza `published_at` e incrementa `version`.
- En el campo título y configuraciones: guardado explícito por formulario.

### 9.4 Anti-cheating

Tres mecanismos en capas:

**a) Bloqueo de instancias paralelas.** Al iniciar un intento se genera un `attempt_session_token` random específico para ese intento. El cliente lo conserva en cookie separada o lo envía como header firmado; en DB se guarda `attempt_session_token_hash`, nunca el token plano. En cada PATCH/submit, el servidor valida token + hash. Si una segunda pestaña inicia o reutiliza mal el intento, la primera pestaña recibe `409 duplicate_instance` y muestra: "Este quiz fue abierto en otra ventana. Solo puedes tenerlo abierto en una a la vez."

**b) Detección de cambio de pestaña.** El cliente usa `document.visibilitychange` y `window.blur/focus`. Cada evento se envía a `/api/attempts/[id]/events` con tipo `tab_blur` o `tab_focus`.

**c) Detección de paste / copy.** Listeners en los inputs de respuesta. Eventos `paste` y `copy` se envían como `attempt_events`.

**Política:** los eventos se registran pero no bloquean automáticamente al estudiante. En UX no se usa "trampa detectada". El mensaje para el estudiante debe ser neutral: **"Actividad registrada durante el intento."** En el dashboard del profesor se aclara: **"Estos eventos no prueban fraude por sí solos; deben interpretarse con criterio."**

**No se implementa en MVP:** detección de fullscreen exit, detección de devtools open, captura forzada de cámara/audio.

### 9.5 Mostrar respuestas correctas

Política definida en `quizzes.show_correct_answers`:

| Valor | Comportamiento |
|---|---|
| `never` | El estudiante nunca ve cuáles eran las correctas. |
| `after_submit` | Inmediatamente tras submit, ve sus respuestas marcadas como correctas/incorrectas con explicación. |
| `after_close` | Solo después de `closes_at`. Si `closes_at` es `null`, equivale a `never`. |

Implementación: vista pública `quiz_questions_public` que omite las claves sensibles del `body` (`is_correct`, `correct`, `accepted_answers`, `expected`) salvo cuando el endpoint determina que la política permite mostrarlas.

### 9.6 Snapshots y control transaccional de intentos

Al iniciar un intento, el backend crea una transacción que:

1. Bloquea el quiz o una fila auxiliar de control con `select ... for update`.
2. Cuenta intentos existentes del estudiante para ese quiz en estados `in_progress`, `submitted` y `graded`.
3. Valida `attempts_allowed`.
4. Asigna `attempt_number = count + 1`.
5. Crea `attempts` con `unique(quiz_id, student_id, attempt_number)`.
6. Copia las preguntas vigentes a `attempt_questions`, aplicando shuffle si corresponde.
7. Usa `idempotency_key` opcional para evitar duplicados por doble click o reintentos de red.

Las respuestas (`answers`) siempre apuntan a `attempt_questions`, no a `quiz_questions`. Así el intento conserva exactamente lo que vio el estudiante aunque el profesor edite preguntas después.

---

## 10. Seguridad y RLS

### 10.1 Principios

- **Profesor:** lee/escribe lo suyo via `professor_id = auth.uid()`.
- **Público anónimo:** lee únicamente contenido publicado y visible (regla §6.2).
- **Estudiante:** nunca escribe directo. Solo via Route Handlers que validan JWT, verificación de correo y token específico de intento.
- **Respuestas correctas:** ocultas hasta cumplir política.
- **Eventos anti-cheating:** solo el profesor de la clase ve los de sus quizzes.
- **Rate limiting:** endpoints sensibles limitados por IP + endpoint + ventana temporal.

### 10.2 Políticas RLS principales

Hay que separar explícitamente dos conceptos:

- `public_module_list`: permite mostrar metadata de módulos publicados aunque todavía estén programados, cerrados o bloqueados. Esto permite una landing con candados y fechas.
- `public_module_contents`: solo permite leer contenidos cuando el módulo está efectivamente disponible.

```sql
-- classes: lectura pública si publicada y no eliminada
create policy "public reads published classes"
  on classes for select
  using (is_published = true and deleted_at is null);

-- classes: profesor maneja las suyas
create policy "professor manages own classes"
  on classes for all
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

-- modules: lectura pública si visible (publicado + disponible + dentro de ventana)
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

-- contents: lectura pública solo si módulo visible Y disponible
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

-- attempts: profesor lee los de quizzes de sus clases
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
```

### 10.3 Filtrado de respuestas correctas

```sql
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
```

La vista no debe ser la única defensa. Cualquier endpoint público debe usar funciones de aplicación como `get_public_quiz_questions(quiz_id, student_id)` o snapshots ya sanitizados. Nunca se expone `quiz_questions` crudo al cliente.

En TypeScript deben existir tipos separados:

```typescript
type QuizQuestionPrivate = { body: PrivateQuestionBody };
type QuizQuestionPublic = { body: PublicQuestionBody };
type AttemptQuestionSnapshot = { body_snapshot: PrivateQuestionBody | PublicQuestionBody };
```

### 10.4 Storage (Cloudflare R2)

**Buckets:**

- `aula-public`: portadas de clase, imágenes de contenido público. Acceso vía CDN.
- `aula-private`: archivos descargables, asociados a contenidos. Acceso via URL firmada con TTL de 15 minutos.

**Path:** `{classId}/{moduleId}/{contentId}/{filename}`.

**Upload:** desde el cliente, el profesor solicita una URL firmada a `/api/uploads/sign` que valida ownership y devuelve un PUT signed URL de R2 con TTL de 5 minutos.

**Lectura:** los `cover_url` y `body.storage_path` apuntan directamente a URLs públicas del CDN (público) o son resueltos a URLs firmadas (privado) por el server al renderizar.

### 10.5 Rate limiting

Endpoints con límite obligatorio:

- `/api/student/session`
- `/api/student/session/verify`
- `/api/quizzes/[id]/attempts`
- `/api/attempts/[id]/events`
- `/api/attempts/[id]/answers/batch`
- `/api/uploads/sign`

Para MVP se puede usar Upstash Redis. Si se quiere evitar otra dependencia, la tabla `rate_limits` permite limitar por `IP + endpoint + ventana temporal`. La respuesta estándar es `429` con un mensaje claro y sin revelar detalles internos.

---

## 11. Validaciones y schemas

Todos los inputs validan con **Zod** en cliente y servidor. Schemas compartidos en `lib/schemas/*.ts`.

### 11.1 Reglas de validación

| Campo | Regla |
|---|---|
| `class.title` | string, 3–80 caracteres, sin saltos de línea |
| `class.slug` | regex `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–60 caracteres, único activo |
| `class.description` | string opcional, 0–500 caracteres |
| `class.accent` | enum de los 8 valores |
| `class.lockup_split_at` | int opcional, ≥ 1, ≤ `length(title)` |
| `module.title` | string, 3–80 caracteres |
| `module.slug` | regex igual a class.slug, único por clase |
| `module.opens_at < closes_at` | si ambos definidos |
| `content.title` | string, 3–120 caracteres |
| `content.slug` | regex igual a class.slug, único por módulo |
| `quiz.time_limit_min` | int opcional, 1–180 |
| `quiz.attempts_allowed` | int, 1–5 |
| `quiz.max_score` | numeric, 1–1000 |
| `quiz_question.prompt` | string, 5–1000 caracteres |
| `quiz_question.points` | numeric, 0.25–100 |
| `quiz_question.options` (choice) | array, 2–10 items |
| `option.text` | string, 1–200 caracteres |
| `short_answer.accepted_answers` | array, 1–10 items, cada uno 1–100 caracteres |
| `student.email` | regex de email RFC 5322, max 320 caracteres |
| `student.first_name` / `student.last_name` | string requerido para quizzes calificables, 1–80 caracteres |
| `student.email_code` | 6 dígitos, expira, se guarda hasheado |
| `student.display_name` | string opcional, 1–80 caracteres |
| `grade_category.name` | string, 1–50 caracteres |
| `grade_category.weight` | numeric, 0–100, max 2 decimales |
| `grade_categories.weight` (suma por clase) | exactamente 100 (validado en cliente con feedback visual; servidor permite save parcial) |
| Suma de `quiz_questions.points` por quiz | = `quiz.max_score` (validado en cliente con feedback) |
| Portada (upload) | JPG/PNG/WebP, máx 2 MB, mín 800×400 |
| Archivo (upload) | PDF/DOCX/XLSX/PPTX/ZIP/MP3/MP4, máx 25 MB |

### 11.2 Límites del sistema

| Recurso | Límite |
|---|---|
| Módulos por clase | 16 |
| Contenidos por módulo | 30 |
| Preguntas por quiz | 50 |
| Opciones por pregunta choice | 10 |
| Markers por mapa | 50 |
| Intentos permitidos por quiz | 5 |
| Notificaciones in-app (rolling window) | 200, FIFO |
| Eventos de intento | 500 por intento, FIFO al exceder |

### 11.3 Schemas Zod principales

```typescript
// lib/schemas/class.ts
import { z } from 'zod';

export const slugSchema = z.string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo lowercase, números y guiones.")
  .min(3).max(60);

export const accentSchema = z.enum([
  'indigo','terracota','bosque','ciruela',
  'ambar','pizarra','borgona','salvia'
]);

export const createClassSchema = z.object({
  title: z.string().min(3).max(80),
  slug: slugSchema,
  description: z.string().max(500).optional(),
  accent: accentSchema.default('indigo'),
  visibility: z.enum(['public','unlisted']).default('unlisted'),
});

export const updateClassSchema = createClassSchema.partial().extend({
  version: z.number().int().positive(),    // optimistic locking
  lockup_split_at: z.number().int().min(1).nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  is_published: z.boolean().optional(),
});

// lib/schemas/module.ts
export const moduleAvailabilitySchema = z.object({
  is_published: z.boolean(),
  is_available: z.boolean(),
  opens_at: z.string().datetime().nullable(),
  closes_at: z.string().datetime().nullable(),
}).refine(
  data => !data.opens_at || !data.closes_at || data.opens_at < data.closes_at,
  { message: "closes_at debe ser posterior a opens_at" }
);

// lib/schemas/quiz.ts
export const quizQuestionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('single_choice'),
    prompt: z.string().min(5).max(1000),
    points: z.number().min(0.25).max(100),
    body: z.object({
      options: z.array(z.object({
        id: z.string(),
        text: z.string().min(1).max(200),
        is_correct: z.boolean(),
      })).min(2).max(10).refine(
        opts => opts.filter(o => o.is_correct).length === 1,
        { message: "Debe haber exactamente una opción correcta" }
      ),
      explanation: z.string().max(500).optional(),
    }),
  }),
  // multi_choice, true_false, short_answer, map_pin… similar
]);

// lib/schemas/content.ts
export const contentSchema = z.object({
  title: z.string().min(3).max(120),
  slug: slugSchema,
  type: z.enum(['rich_text','video','map','file','quiz']),
});

// lib/schemas/student.ts
export const studentSessionRequestSchema = z.object({
  email: z.string().email().max(320),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  remember_me: z.boolean().default(false),
});

export const studentSessionVerifySchema = z.object({
  email: z.string().email().max(320),
  code: z.string().regex(/^\d{6}$/),
  remember_me: z.boolean().default(false),
});

// lib/schemas/attempt.ts
export const answerDraftSchema = z.object({
  question_id: z.string().uuid(), // attempt_questions.id
  response: z.unknown(),          // validado por tipo de snapshot server-side
  client_updated_at: z.string().datetime().optional(),
});

export const batchAnswersSchema = z.object({
  answers: z.array(answerDraftSchema).min(1).max(50),
});

export const submitAttemptSchema = z.object({
  attempt_id: z.string().uuid(),
  attempt_session_token: z.string().min(32),
});
```

---

## 12. Manejo de errores y estados

### 12.1 Códigos de error

| Código | Significado | UX |
|---|---|---|
| `400` | Error de validación | Inline en formulario (campo por campo) |
| `401` | No autenticado | Profe → redirect `/login`. Estudiante → re-pedir email |
| `403` | No autorizado | Página de error genérica |
| `404` | Recurso no encontrado | Página `/404` editorial |
| `409` | Conflicto (slug duplicado, instancia paralela, version mismatch) | Mensaje específico, opción de recargar |
| `410` | Recurso eliminado (soft) | Página informativa |
| `422` | Validación de dominio (quiz cerrado, tiempo expirado) | Mensaje específico |
| `429` | Rate limit | Banner "Estás haciendo demasiadas solicitudes, intenta más tarde" |
| `500` | Error de servidor | Página `/500` con error ID |

### 12.2 Plantillas de error

**Plantilla genérica de 400 (formulario):**

```json
{
  "error": "validation_error",
  "message": "Hay errores en el formulario.",
  "fields": {
    "title": "Debe tener entre 3 y 80 caracteres.",
    "slug": "Ya existe una clase con este slug."
  }
}
```

El cliente mapea `fields` a los inputs correspondientes y muestra el mensaje bajo cada uno.

**Plantilla genérica de 500:**

```json
{
  "error": "internal_error",
  "message": "Algo salió mal de nuestro lado.",
  "error_id": "err_abc123def456"
}
```

El cliente muestra un toast con el mensaje y el `error_id` (copiable) y un botón "Reportar". El `error_id` también se envía a Sentry.

### 12.3 Páginas de error

- `/404`: editorial, con lockup grande "página no encontrada" y link a `/`.
- `/500`: similar, con error ID destacado y botón de reportar.
- Error boundary global de React: captura errores de cliente, muestra fallback minimalista, reporta a Sentry.

### 12.4 Estados vacíos y de carga

Definidos en wireframes:

- Dashboard sin clases (onboarding).
- Módulo recién creado sin contenidos.
- Gradebook sin estudiantes.
- Cola de intentos limpia.

Estados de carga: skeleton loaders en listados, spinners en botones, indicador "Guardando..." en auto-guardado.

---

## 13. Soft delete y anonimización

### 13.1 Soft delete

Tablas con `deleted_at`:

- `classes`, `modules`, `contents`, `quizzes`, `grade_items`, `grade_categories`, `grades`.

Tablas con hard delete controlado desde su parent directo:

- `quiz_questions`: pueden borrarse si el quiz se hard-deletea, porque los intentos históricos conservan snapshot en `attempt_questions`.
- `answers`, `attempt_questions`, `attempt_events`: dependen del intento y se conservan mientras el intento exista.

Tablas que no deben borrarse por cascada desde contenido académico:

- `attempts`: evidencia académica. `attempts.quiz_id` usa `on delete set null` y el intento conserva sus preguntas mediante snapshots.
- `students`: ver anonimización.
- `notifications`: TTL de 90 días via cron.

### 13.2 Comportamiento al borrar

| Acción | Resultado |
|---|---|
| Profe borra clase | `classes.deleted_at = now()`. Cascade lógico: módulos, contenidos, quizzes, grade_items quedan accesibles para el profe en una sección de "Archivo" en el dashboard, recuperables por 30 días, luego hard delete por cron. |
| Profe borra módulo | `modules.deleted_at = now()`. Contenidos y quizzes asociados quedan deleted_at también. |
| Estudiante solicita eliminación | Anonimización (no hard delete). |

### 13.3 Anonimización del estudiante

**Endpoint:** `/api/student/anonymize`. Requiere confirmación por email (envía link con token).

**Proceso:**

1. `students.email` → `redacted-{uuid}@aula.local`.
2. `students.display_name` → `null`.
3. `students.notes` → `null`.
4. `students.is_anonymized = true`, `anonymized_at = now()`.
5. Los `attempts`, `answers` y `grades` quedan asociados al `student.id` anonimizado.

Esto permite preservar la integridad del gradebook sin retener PII.

### 13.4 Restauración

El profesor tiene una sección `/dashboard/archivo` que lista clases, módulos y contenidos soft-deleted en los últimos 30 días con botón "Restaurar". Pasados los 30 días, un cron job hace hard delete.

---

## 14. Notificaciones

### 14.1 Para el profesor (in-app)

Tabla `notifications`. Centro de notificaciones en el header del dashboard (ícono campana) y página dedicada `/dashboard/notificaciones`.

**Tipos:**

| Tipo | Trigger | Ejemplo de copy |
|---|---|---|
| `new_attempt_submitted` | Estudiante envía un quiz | "Carlos envió Evaluación módulo 2" |
| `manual_review_needed` | Intento submitted con preguntas pendientes | "1 intento espera tu revisión en Historia bíblica" |
| `quiz_window_closing` | 24h antes de `closes_at` | "Evaluación módulo 2 cierra mañana a las 22:00" |
| `module_opening_today` | El día que `opens_at` ocurre | "Módulo 3 abre hoy a las 7:00" |
| `student_milestone` | Cada 10/50/100 intentos en la plataforma | "Tu plataforma acumula 100 intentos" |

Las notificaciones se marcan como leídas al hacer click. Se muestran agrupadas por clase. Rolling window de 200 (FIFO).

### 14.2 Para el estudiante (email)

Resend con plantillas React Email. Eventos:

| Evento | Asunto |
|---|---|
| Intento enviado | "Recibimos tu intento — Evaluación módulo 2" |
| Intento calificado manualmente | "Tu nota está lista — Evaluación módulo 2" |
| Solicitud de anonimización (confirmación) | "Confirma la eliminación de tus datos" |

Cada email incluye un link de unsubscribe que excluye al estudiante de futuros emails (excepto los de seguridad/legales como la confirmación de anonimización).

Variables de entorno: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`.

---

## 15. Accesibilidad (WCAG 2.1 AA)

### 15.1 Estándares mínimos

- **Contraste:** 4.5:1 para texto normal, 3:1 para texto ≥ 18px o ≥ 14px bold. Validado contra paleta neutra y acentos: todos los acentos sobre `Page` (#FAF8F3) cumplen 4.5:1 mínimo.
- **Navegación con teclado:** todos los elementos interactivos accesibles vía Tab. Orden lógico. Focus visible con outline de 2px en color de acento de la clase activa (o `Ink` en dashboard general).
- **Skip links:** "Saltar al contenido principal" como primer elemento focusable en cada página.
- **ARIA:**
  - Formularios: `<label>` siempre asociado vía `for`/`id`.
  - Errores: `aria-invalid` + `aria-describedby` apuntando al mensaje de error.
  - Estados dinámicos (auto-guardado, contador del quiz): `aria-live="polite"`.
  - Modales: `role="dialog"`, focus trap, restaurar focus al cerrar.
- **Tamaño táctil mínimo:** 44×44 px en todos los botones e íconos clickables.

### 15.2 Mapas

Los mapas Mapbox no son accesibles por sí solos. Compensación:

- Lista textual de markers después del mapa.
- Cada marker textual con `<dl>` semántico: nombre, coordenadas, descripción.
- En preguntas `map_pin`: alternativa de input manual de coordenadas o nombre del lugar como fallback opcional.

### 15.3 Preferencias del usuario

- `prefers-reduced-motion`: deshabilita transiciones y animaciones (auto-save indicator pulsa sin animación, etc.).
- `prefers-color-scheme`: por ahora solo modo claro. Modo oscuro queda fuera del MVP.
- Zoom hasta 200% sin pérdida de funcionalidad.

### 15.4 Testing de accesibilidad

- `@axe-core/playwright` en suite E2E.
- Auditoría manual con NVDA y VoiceOver en pantallas críticas.

---

## 16. Responsive y breakpoints

### 16.1 Breakpoints

| Nombre | Ancho | Comportamiento |
|---|---|---|
| `mobile` | < 640 px | Layout vertical, navegación inferior |
| `tablet` | 640–1023 px | Híbrido, sidebar colapsable |
| `desktop` | ≥ 1024 px | Layout completo con sidebar persistente |
| `wide` | ≥ 1280 px | Padding aumentado, ancho máximo de contenido 1200px |

### 16.2 Adaptación de pantallas clave

**Dashboard (mobile):**
- Top nav simplificado: solo logo + avatar.
- Grid de clases pasa a columna única.
- Stats inline se apilan verticalmente.

**Editor de clase (mobile):**
- Sidebar de módulos se convierte en dropdown horizontal arriba del canvas o en bottom-sheet activable con botón "Módulos".
- Drawer de configuración pasa a full-screen modal.
- Drag & drop sigue funcionando con touch events (dnd-kit lo soporta).

**Editor de quiz (mobile):**
- Sidebar de preguntas pasa a dropdown.
- Editor de pregunta ocupa el ancho completo.
- Mapa de `map_pin` editor toma altura fija de 250px.

**Gradebook (mobile):**
- En lugar de tabla, se renderiza como lista de tarjetas por estudiante: cada card muestra nombre, nota final, y un acordeón con las notas por item.
- Categorías y pesos quedan accesibles vía sheet desde un FAB.

**Landing pública (mobile):**
- Hero lockup escala a 56px max para que quepa en pantallas ≥ 360px.
- Módulos en columna con tap targets grandes.
- Mapas mantienen aspect ratio 4:3 en móvil.

**Quiz en progreso (mobile):**
- Header de timer + email se queda sticky.
- Opciones de respuesta con padding generoso (44px+ de altura).
- Bottom bar con "Anterior / Siguiente" sticky.

### 16.3 Touch vs mouse

- Hover states siempre acompañados de focus states equivalentes.
- Tooltips activables tanto por hover (desktop) como por long-press (mobile).
- Drag handles visibles permanentemente en mobile (no solo en hover).

---

## 17. Observabilidad y admin

### 17.1 Logging

- **Sentry** para errores del cliente y servidor. DSN en `SENTRY_DSN`.
- Cada error capturado incluye `error_id` que el usuario ve y puede reportar.
- PII se scrubbea antes de enviar a Sentry.

No enviar a Sentry:

- Prompts completos ni respuestas completas.
- `body_draft`, `body_published` o cuerpos de contenidos.
- Respuestas de estudiantes.
- JWT, cookies o tokens de intento.
- IP cruda, nombres o correos sin hash.

Scrubbing automático obligatorio para: `email`, `JWT`, `cookies`, `IP`, `first_name`, `last_name`, `display_name`, respuestas de quiz y payloads de intentos.

### 17.2 Métricas

- **Vercel Analytics** para Web Vitals (LCP, FID, CLS, TTFB).
- **Tabla `events`** local para tracking mínimo de producto.

Eventos iniciales recomendados:

- `class_created`
- `module_created`
- `class_published`
- `student_session_started`
- `attempt_started`
- `attempt_submitted`
- `attempt_graded`
- `gradebook_viewed`

No se mide todo desde el inicio. Se mide lo necesario para saber si el producto funciona.

### 17.3 Dashboard de admin

Ruta: `/dashboard/admin`. Visible solo al profesor (en MVP, mismo profe = admin).

**Secciones:**

- **Resumen:** total estudiantes activos 24h/7d/30d, total intentos completados, intentos en curso, intentos abandonados.
- **Quizzes por engagement:** lista ordenada por número de intentos, tiempo promedio, tasa de aprobación.
- **Preguntas problemáticas:** por cada quiz, las 3 preguntas con peor tasa de acierto.
- **Anti-cheating insights:** distribución de eventos `tab_blur` por quiz; top 10 intentos con más eventos sospechosos.
- **Errores recientes:** últimos 50 errores de Sentry (resumido, con link al detalle externo).
- **Salud del sistema:** uptime Vercel, latencia promedio P50/P95, errores 5xx por hora.

### 17.4 Alertas

Configurar en Sentry:

- > 10 errores 5xx en 5 minutos → email al profesor.
- Error nuevo (primer ocurrencia) → email.
- Performance regression > 30% en LCP de landing pública → email.

---

## 18. Testing

### 18.1 Estrategia

| Capa | Stack | Objetivo |
|---|---|---|
| Unit | Vitest | Cálculos de negocio, helpers, schemas Zod |
| Integration | Vitest + Supabase local | Route handlers, RLS, queries |
| E2E | Playwright | Flujos completos de usuario |
| Accessibility | @axe-core/playwright | WCAG en pantallas clave |

### 18.2 Cobertura objetivo para MVP

La meta inicial no es maximizar porcentaje global, sino proteger lógica crítica sin ralentizar el descubrimiento del producto.

**Tests obligatorios:**

- Visibilidad efectiva de módulos y quizzes.
- Cálculo de nota final.
- Auto-calificación por tipo de pregunta.
- Control de intentos permitidos y race conditions básicas.
- Ocultamiento de respuestas correctas.
- RLS básica.
- Submit de quiz.
- Sanitización de contenido público.

**E2E mínimos:**

- Profesor crea clase.
- Profesor publica módulo.
- Estudiante entra.
- Estudiante presenta quiz.
- Profesor ve intento.

**Después del MVP:** ampliar cobertura de accesibilidad, flujos de edición avanzada, import/export, analítica y casos borde de desconexión.

### 18.3 CI

GitHub Actions. En cada PR:

1. Lint + typecheck.
2. Unit tests.
3. Integration tests (Supabase local en Docker).
4. Build.
5. E2E tests contra build (subset crítico).
6. Accessibility tests.

Bloqueante para merge si cualquiera falla.

---

# Parte IV — Visual

## 19. Sistema visual

### 19.1 Dirección

La plataforma vive en un cruce entre **contenido con peso académico/teológico** y la **pulcritud de una herramienta contemporánea**. El lenguaje visual es **editorial moderno**: confianza tipográfica, papel-blanco cálido, espaciado generoso, color con propósito.

Inspiración: estudios de branding contemporáneo (Pentagram, Order, Mucho, &Walsh). El producto se siente más cercano a una pieza editorial que a una app educativa genérica.

### 19.2 Tipografía: el lockup

La marca de cada clase es un **lockup tipográfico**: una composición de dos palabras (o partes de palabra) donde italic serif y sans bold heavy se tocan, formando una unidad visual única.

**Reglas del lockup:**

- La primera palabra del título va en **italic serif**, con peso regular (400) y letter-spacing ligeramente negativo.
- La segunda palabra va en **sans heavy/black** (peso 900), con letter-spacing aún más negativo y un pequeño margin negativo a la izquierda para que se toque con la italic.
- El color de la italic es el **color de acento de la clase**.
- El color del bold es siempre **negro cálido** (`#1A1814`).
- Si el título tiene una sola palabra, el split se hace por mitad (o el profesor define `lockup_split_at`).
- Si tiene más de dos palabras, el sistema combina las palabras 2+ en el bloque bold.

**Ejemplo:**

```
[italic indigo] Historia [/italic][bold negro] bíblica[/bold]
[italic terracota] Geografía [/italic][bold negro] NT[/bold]
```

**Recomendaciones técnicas para implementación:**

- Sans-serif debe tener cortes Black/900 reales (Inter Display, General Sans, Söhne).
- Serif debe tener italic con flourishes (Fraunces, PP Editorial New, Tiempos Headline).
- Usar `font-feature-settings: "ss01"` o equivalente cuando la fuente tenga alternates de italic más expresivos.
- Negro cálido `#1A1814`, nunca `#000` puro.

### 19.3 Escala tipográfica

| Uso | Tipografía | Tamaño / line-height | Peso |
|---|---|---|---|
| Hero lockup landing | Sans heavy + serif italic | 92–110 px / 0.9 | 400 / 900 |
| Hero lockup dashboard | Sans heavy + serif italic | 44–64 px / 0.9 | 400 / 900 |
| H1 página interna | Serif regular | 22 px / 1.2 | 400 |
| H2 sección | Sans medium | 16 px / 1.3 | 500 |
| Body | Sans regular | 13 px / 1.65 | 400 |
| Caption | Sans semibold caps | 11 px / 1.4, tracking 0.08em | 600 |
| Eyebrow | Sans bold caps | 11 px / 1.4, tracking 0.16em | 700 |
| Mono | Mono regular | 11 px / 1.5 | 400 |

### 19.4 Paleta neutra

Cálida en lugar de gris frío. Evoca lectura prolongada y separa la plataforma del look corporativo.

| Token | Hex | Uso |
|---|---|---|
| Page | `#FAF8F3` | Fondo de página principal |
| Surface | `#FFFFFF` | Tarjetas, modales |
| Surface alt | `#F0EDE5` | Fondos secundarios, chrome de browser |
| Ink | `#1A1814` | Texto primario, bold del lockup |
| Ink soft | `#6B665C` | Texto secundario, body |
| Ink mute | `#A8A398` | Caption, metadata, deshabilitado |

### 19.5 Paleta de acentos por clase

Ocho colores curados, asignables como `accent` al crear la clase. Cada uno se usa para la italic del lockup, los pins del mapa, los estados activos de UI específicos de esa clase, y los detalles de progreso.

| Token | Hex | Personalidad |
|---|---|---|
| `indigo` | `#4C51BF` | Intelectual, profundo |
| `terracota` | `#C25733` | Cálido, histórico |
| `bosque` | `#24755B` | Natural, contemplativo |
| `ciruela` | `#9B478A` | Místico |
| `ambar` | `#C18924` | Cálido, sabiduría |
| `pizarra` | `#3F638A` | Sobrio, académico |
| `borgona` | `#922F41` | Clásico, importante |
| `salvia` | `#737A43` | Tranquilo, sapiencial |

### 19.6 Identidad de clase

Cada clase es identificable por la combinación de tres elementos:

1. **El lockup tipográfico** (italic + bold con su corte característico).
2. **El color de acento** (que tiñe la palabra italic y los detalles UI específicos de la clase).
3. **El número romano** (`i`, `ii`, `iii`, …) en italic serif pequeña que acompaña metadata.

Esta tríada se repite consistentemente: en la card del dashboard, en el header de la landing pública, en breadcrumbs, en el cover de cada módulo. Construye memoria visual ("la clase indigo" = Historia bíblica).

### 19.7 Tokens base

**Radios:** 4px (chips, dots), 8px (inputs, botones), 12px (cards), 14px (modales), 999px (pills).

**Espaciado:** escala de 8 (8 / 16 / 24 / 32 / 40 / 56 px). Generosa para favorecer la lectura prolongada.

**Bordes:** 0.5px en lugar de 1px. Más sutiles, más editoriales. Color `rgba(0,0,0,0.08)` sobre fondo claro.

**Sombras:** ninguna en el sistema base. La jerarquía la dan la tipografía y el espaciado.

### 19.8 Mapas

Los mapas (Mapbox GL JS) usan un **estilo personalizado** alineado con la paleta:

- Base: tonos cálidos derivados del `Surface alt` (#F0EDE5), terrenos y mares en gamas crema y arena.
- Calles, fronteras y etiquetas en grises neutros derivados de la paleta `Ink`.
- Tipografía del mapa: sans regular, peso medio.
- **Pins de la clase:** en el color de acento (`accent`) de la clase, sin gradientes ni iconografía adicional. Estilo "tear-drop" minimalista.
- **Círculo de tolerancia (preguntas tipo `map_pin`):** misma paleta de acento con opacidad baja para el relleno y línea punteada para el contorno.

Esto garantiza que cuando un estudiante esté en Historia bíblica vea pins indigo coherentes con el resto de la UI, y en Geografía NT vea pins terracota.

### 19.9 Principios de diseño

- **Cero ornamento:** sin sombras, sin gradientes, sin texturas. La jerarquía la dan tipografía y espaciado.
- **Color al servicio del contenido:** el color de acento marca identidad de clase, no decora UI. Estados semánticos (éxito, error, advertencia) van en gris neutro con íconos.
- **Densidad amable:** más aire que el estándar edtech. Cada bloque respira. Modelo más cercano a Substack que a Moodle.
- **Cursivas como guiño:** la cursiva de la serif aparece en subtítulos y momentos narrativos. Pequeñas dosis. Hace que el producto se sienta hecho a mano.

---

# Parte V — Flujos

## 20. Flujos de usuario clave

### 20.1 Profesor crea una clase y publica

1. `/dashboard` → "Nueva clase".
2. Define título y descripción. Slug se autogenera y es editable.
3. Elige color de acento (default `indigo`).
4. Estado inicial: `draft` (`is_published=false`).
5. Agrega módulos. Cada uno con su propia disponibilidad (default disponible cuando se publica).
6. Dentro de cada módulo, agrega contenidos por tipo.
7. Configura quizzes: preguntas, puntajes, política de intentos, disponibilidad.
8. Vista previa en `/c/[slug]` (visible solo al profesor en draft).
9. Publica la clase desde `/configuracion`.

### 20.2 Profesor secuencia un curso semanal

1. Crea todos los módulos del curso con su contenido.
2. Marca todos como publicados pero con `opens_at` escalonado (semana 1, semana 2, etc.).
3. La landing pública muestra todos los módulos: los actuales abiertos, los futuros con candado y fecha de apertura.
4. Los módulos se desbloquean automáticamente al pasar el `opens_at`.

### 20.3 Estudiante accede a una clase y presenta un quiz

1. Recibe enlace `https://app.com/c/historia-biblica`.
2. Navega por módulos visibles sin autenticarse. Los módulos bloqueados se ven con candado y fecha.
3. Al hacer click en un quiz disponible, ve la pantalla de inicio del quiz.
4. Si no tiene cookie de sesión: aparece el modal de correo (con "Recordarme").
5. Ingresa correo → backend hace upsert en `students`, emite JWT, setea cookie.
6. Inicia el intento (se crea registro en `attempts` con `status='in_progress'`).
7. Responde preguntas. Auto-guardado tras cada cambio.
8. Al hacer submit:
   - Se evalúan automáticamente las preguntas auto-calificables.
   - Se persiste el `attempt` con `status='submitted'` o `'graded'`.
   - Si todas son auto-calificables, se inserta/actualiza la fila en `grades`.
9. Ve la pantalla de resultado según `show_correct_answers`.

### 20.4 Profesor revisa intentos pendientes

1. `/dashboard/clases/[id]/intentos` → ve cola filtrada por `status='submitted'`.
2. Abre un intento → ve preguntas con `is_correct=null` y los eventos anti-cheating asociados.
3. Asigna puntos y feedback.
4. Al guardar, recalcula score total, marca `status='graded'`, actualiza `grades`.

### 20.5 Profesor gestiona el gradebook

1. `/dashboard/clases/[id]/calificaciones/categorias` → define categorías y pesos. Validación visual de que sumen 100%.
2. `/dashboard/clases/[id]/calificaciones` → tabla con estudiantes en filas, items en columnas, nota final calculada en la última columna.
3. Para items manuales: edición inline del score.
4. Para items de quiz: lectura, con link al intento si quiere ajustar.

---

# Parte VI — Operación

## 21. Configuración (env vars)

Todas las variables se cargan desde `.env.local` en desarrollo y desde **Vercel Environment Variables** en staging y producción.

```bash
# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=           # server-only, nunca expuesta

# === JWT del estudiante ===
STUDENT_JWT_SECRET=                  # 32+ caracteres random
STUDENT_JWT_ISSUER=aula
STUDENT_JWT_TTL_DEFAULT=86400        # 24h sin remember me
STUDENT_JWT_TTL_REMEMBER=2592000     # 30d con remember me

# === Cloudflare R2 ===
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ACCOUNT_ID=
R2_BUCKET_PUBLIC=aula-public
R2_BUCKET_PRIVATE=aula-private
R2_PUBLIC_URL=                       # CDN: https://cdn.aula.com
R2_ENDPOINT=                         # https://{account_id}.r2.cloudflarestorage.com

# === Email (Resend) ===
RESEND_API_KEY=
EMAIL_FROM="Aula <hola@aula.com>"
EMAIL_REPLY_TO=

# === Mapbox ===
NEXT_PUBLIC_MAPBOX_TOKEN=            # token público con scope restringido
MAPBOX_STYLE_URL=mapbox://styles/aula/custom

# === Observabilidad ===
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
NEXT_PUBLIC_SENTRY_ENABLED=true

# === Configuración ===
NEXT_PUBLIC_APP_URL=                 # https://app.aula.com
NEXT_PUBLIC_DEFAULT_TIMEZONE=America/Bogota
NODE_ENV=production
```

`SUPABASE_SERVICE_ROLE_KEY`, `STUDENT_JWT_SECRET`, `R2_SECRET_ACCESS_KEY` y `RESEND_API_KEY` son **server-only** y nunca se exponen al cliente.

---

## 22. Backup y recuperación

### 22.1 Backups automáticos de Supabase

- **PITR (Point-In-Time Recovery)** hasta **7 días** atrás. Granularidad de minutos.
- **Snapshots diarios** retenidos 30 días.
- Incluido en plan Pro de Supabase.

### 22.2 Backup adicional semanal

Cron job de Vercel (lunes 3am Bogotá):

1. Exporta todas las tablas críticas como CSV (`pg_dump --format=csv` via función SQL).
2. Comprime y sube a R2 bucket privado `aula-backups`.
3. Retención: 12 semanas (3 meses). Cron de limpieza separado.

### 22.3 Recuperación

**Runbook documentado en repo** (`/docs/runbook-recovery.md`):

- **Caso A: error humano puntual** (profe borró una clase importante): usar soft delete; restaurar desde `/dashboard/archivo` si < 30 días.
- **Caso B: corrupción de datos** (versión rota, query mal ejecutada): PITR a 5–60 minutos atrás.
- **Caso C: desastre completo** (DB perdida): restaurar el snapshot más reciente, complementar con el CSV semanal si necesario.

RTO objetivo: 4 horas. RPO objetivo: 24 horas (peor caso, ideal es 1 minuto con PITR).

---

## 23. SEO y privacidad

### 23.1 SEO

- **`robots.txt`**: `User-agent: * \n Disallow: /`. La aplicación no se indexa.
- **`<meta name="robots" content="noindex, nofollow" />`** global como respaldo.
- **Open Graph y Twitter Cards**: se generan para landing pública (`/c/[slug]`) y para cada módulo/contenido. Permite previsualización rica cuando se comparte por WhatsApp, Slack, etc.

```html
<!-- Open Graph de landing -->
<meta property="og:title" content="Historia bíblica I" />
<meta property="og:description" content="Del Génesis a los jueces. Recorrido por la formación de Israel." />
<meta property="og:image" content="{cover_url o auto-generada via OG image API}" />
<meta property="og:type" content="article" />
<meta property="og:locale" content="es_CO" />
```

- **OG image dinámico**: ruta `/api/og?classId=...` que renderiza una imagen 1200×630 usando `@vercel/og` con el lockup, color de acento y portada de la clase. Cacheada.

### 23.2 Política de privacidad

Documento accesible en `/privacidad`. Resumen:

**Qué datos recolectamos:**
- Del profesor (auth): email, hash de contraseña, metadata de sesión.
- Del estudiante: email (obligatorio para intentos), display name (opcional), intentos, respuestas y notas. Eventos del quiz (cambios de pestaña, paste). IP en logs del servidor (90 días, anonimizada).

**Por cuánto tiempo:**
- Indefinidamente mientras existan las clases asociadas.
- Eliminados al eliminar la clase, o por solicitud explícita del estudiante.

**Cookies que usamos:**
- Cookie de sesión del profesor (Supabase Auth).
- Cookie de sesión del estudiante (JWT propio, `aula_student`).
- No usamos cookies de analytics ni de terceros.

**Compartición con terceros:**
- Supabase: procesador de base de datos y autenticación.
- Vercel: hosting.
- Cloudflare: CDN y storage.
- Resend: email transaccional.
- Sentry: telemetría de errores (con PII hasheada).

Ninguno usa los datos para fines distintos al servicio.

**Derechos del estudiante:**
- Acceso: solicitar copia de sus datos vía email a `privacidad@aula.com`.
- Eliminación: anonimización vía `/privacidad/eliminar` con confirmación por email.
- Rectificación: contactar al profesor para corregir display name o notas; los emails se modifican vía soporte.

**Menores de edad:**
- La plataforma no está dirigida a menores de 14 años.
- Para usuarios entre 14 y 17, el profesor es responsable de obtener autorización de los tutores antes de compartir la clase.

**Contacto:** `privacidad@aula.com`.

**Última actualización:** [fecha de publicación].

---

# Parte VII — Decisiones

## 24. Decisiones de diseño relevantes

### 24.1 `body_draft` y `body_published` como `jsonb` para contenidos

Almacenar el payload de cada tipo de contenido en columnas `jsonb` permite agregar tipos nuevos sin migraciones. Se separa `body_draft` de `body_published` para que el autosave del editor no afecte lo público hasta que el profesor haga **Publicar cambios**.

### 24.2 Quizzes en tablas relacionales (no en `jsonb`)

Los quizzes se rompen en `quizzes`, `quiz_questions`, `attempts`, `answers` porque las queries del gradebook (promedios, intentos por estudiante, preguntas más falladas) son triviales con relaciones y muy complicadas con JSON anidado.

### 24.3 JWT firmado y verificación de correo para estudiante

Cookie httpOnly con JWT firmado, no solo el email en plano. Para quizzes calificables se exige código de 6 dígitos enviado al correo, porque un JWT firmado evita manipulación del token, pero no impide que alguien escriba el correo de otro estudiante. Si el secreto rota, los estudiantes simplemente vuelven a verificar su correo.

### 24.4 Mismo modelo de disponibilidad para módulos y quizzes

Reusar `is_available` + `opens_at` + `closes_at` en ambas tablas da al profesor un vocabulario consistente. Aprende una vez, aplica en todas partes. También simplifica el código y permite una UI uniforme.

### 24.5 Auto-split del lockup con override manual

El campo `lockup_split_at` por default es `null` (el sistema decide). Esto da experiencia rápida al profesor: crea una clase y ya tiene un lockup decente. Cuando el split automático no funciona (título de tres palabras, palabra extranjera), el profesor puede ajustarlo manualmente.

### 24.6 Negro cálido en lugar de negro puro

`#1A1814` y no `#000`. El negro puro sobre crema se ve azulado y duro. El cálido se asienta con el fondo papel y da el aire impreso/editorial.

### 24.7 Roster por clase con `class_students`

`students` conserva la identidad global mínima por correo, pero `class_students` representa la pertenencia a una clase. Esto permite importar estudiantes, ver roster antes de que respondan quizzes, crear notas manuales para estudiantes sin intentos y separar el display name por clase.

### 24.8 Server authoritative para el tiempo del quiz

El reloj corre del lado del servidor (`expires_at` en `attempts`). El cliente solo computa el display. Esto evita manipulación trivial (cambiar la hora del sistema, pausar JS).

### 24.9 Optimistic locking con campo `version`

Cada tabla con edición concurrente posible incluye `version int`. Cada UPDATE incrementa la versión, y los PATCH desde el cliente envían la versión leída. Si no coincide, error `409` con instrucción de recargar. Más simple que pessimistic locking y suficiente para un solo profesor con múltiples pestañas.

### 24.10 Soft delete con restauración temporal

30 días de gracia antes del hard delete. Da margen para recuperar errores humanos sin acumular datos indefinidamente.

### 24.11 Cloudflare R2 sobre Supabase Storage

R2 ofrece CDN nativo, sin egress fees y mejor rendimiento global. Supabase Storage es válido pero más caro al escalar. R2 también permite mover assets a Workers para procesamiento si se necesita.

### 24.12 Email transaccional via Resend

DX moderno, plantillas en React, precio razonable. Alternativa Postmark (más enterprise) descartada por costo.

### 24.13 Anti-cheating no bloqueante

Los eventos se registran pero no bloquean la presentación del quiz. El profesor decide qué hacer al revisar. Filosofía: la plataforma asiste, no policía.

### 24.14 Una sola zona horaria fija (GMT-5)

`America/Bogota` como default. Display siempre en zona del navegador, pero los inputs de fecha del profesor asumen Bogotá. Si el profesor viaja, el sistema lo respeta vía `Intl.DateTimeFormat`. Multi-timezone real queda fuera del MVP.

### 24.15 Sin modo oscuro en MVP

La paleta neutra cálida funciona en luz natural y se asienta visualmente. Modo oscuro requeriría redefinir contraste en los 8 acentos y los lockups. Se documenta como mejora futura.

### 24.16 Capa de servicios y repositorios

La lógica de negocio no debe vivir directamente en route handlers ni server actions. Estructura sugerida:

```txt
/src
  /app
  /components
  /features
    /classes
    /modules
    /contents
    /quizzes
    /attempts
    /gradebook
  /lib
    /db
    /schemas
    /auth
    /storage
    /email
  /server
    /services
      classService.ts
      quizService.ts
      attemptService.ts
      gradebookService.ts
    /repositories
      classRepo.ts
      quizRepo.ts
```

Los route handlers deben ser delgados: validar request, llamar servicio y retornar response.

### 24.17 Reglas de dominio centralizadas

Funciones puras obligatorias:

- `getModuleEffectiveState(module, now)`
- `getQuizEffectiveState(quiz, now)`
- `calculateAttemptScore(...)`
- `calculateGradebookFinal(...)`
- `canStartAttempt(...)`
- `canSubmitAttempt(...)`
- `sanitizeQuestionForPublic(...)`

Estas funciones deben tener tests unitarios.

### 24.18 Servidor como autoridad

El cliente puede mostrar UI, pero el servidor decide:

- Si un quiz está abierto.
- Si un intento sigue válido.
- Si una respuesta es correcta.
- Si ya superó intentos permitidos.
- Si puede ver respuestas correctas.
- Si puede acceder a un archivo privado.

---

## 25. Performance y caché

La estrategia de caché debe tener cuidado con `now()`, `opens_at` y `closes_at`. Un caché demasiado largo puede mostrar un módulo como cerrado cuando ya abrió, o como abierto cuando ya cerró.

Reglas:

- Landing pública de clase: cacheable, con revalidación corta si hay módulos o quizzes con ventanas activas cercanas.
- Al publicar o cambiar disponibilidad: llamar `revalidatePath` para la clase, módulo y contenido afectados.
- El estado efectivo se calcula en servidor, no en cliente.
- Dashboard: sin caché público.
- Quiz en progreso: `no-store`.
- Respuestas, intentos y eventos: nunca cachear.

Estrategia sugerida:

- Clase sin módulos programados: caché más largo.
- Clase con `opens_at`/`closes_at` cercanos: caché corto.
- Páginas de intento: siempre frescas y validadas contra servidor.

---

## 26. Funciones operativas faltantes

### 26.1 Importar, exportar y duplicar

Estas funciones aceleran mucho el uso real del producto y deberían entrar temprano después del gradebook simple:

- Exportar calificaciones CSV.
- Exportar intentos.
- Importar estudiantes al roster.
- Duplicar clase.
- Duplicar módulo.
- Duplicar quiz.

Duplicar clase/módulo/quiz tiene más impacto práctico que varias features avanzadas, porque permite reutilizar estructura de cursos y evaluaciones.

### 26.2 Búsqueda interna

El dashboard debe contemplar búsqueda por clase, módulo, contenido, quiz y estudiante. No es P0, pero debe quedar previsto para cuando haya más volumen de contenido.

### 26.3 Estados de publicación en lenguaje humano

Aunque el modelo usa `is_published`, `is_available`, `opens_at` y `closes_at`, la UI no debe mostrar esos términos crudos. Debe traducirlos a estados claros:

- Borrador.
- Publicado y abierto.
- Publicado pero bloqueado.
- Programado.
- Cerrado.

---

## 27. Roadmap

### Fase 0 — Setup

- Repo.
- Next.js.
- Supabase local.
- Auth profesor.
- Layout base.
- CI básico.
- Variables de entorno.
- Sentry mínimo con scrubbing de PII.

### Fase 1 — Contenido público

- `classes`.
- `modules`.
- `contents`.
- Slugs completos: clase, módulo y contenido.
- Dashboard simple.
- Landing pública.
- Rich text básico con sanitización.
- Publicación con `body_draft` / `body_published`.
- Preview de profesor.

### Fase 2 — Quiz básico

- `quizzes`.
- `quiz_questions`.
- `attempts`.
- `attempt_questions` snapshots.
- `answers` apuntando al snapshot.
- Estudiante por correo verificado.
- Single choice.
- Submit.
- Resultado.
- Dashboard de intentos.

### Fase 3 — Gradebook simple

- `class_students` / roster.
- `grade_items`.
- `grades`.
- Auto-población desde quiz.
- Export CSV.
- Nota final simple.
- Auditoría básica de cambios de notas.

### Fase 4 — Robustez

- Availability windows.
- `attempts_allowed` con control transaccional.
- RLS completo.
- Rate limiting.
- Testing E2E crítico.
- Política de caché por estado efectivo.

### Fase 5 — Experiencia avanzada

- Tiptap completo.
- R2 uploads.
- Mapas.
- Anti-cheating como señal no concluyente.
- Emails.
- Admin analytics.
- Accessibility audit.
- Importar estudiantes.
- Duplicar clase, módulo y quiz.

---

## 28. Decisiones pendientes

Quedan estas dos, ambas no bloqueantes para empezar Fase 0:

1. **Logotipo final de la plataforma:** elección entre las variantes A.01–A.05 exploradas. Puede definirse durante Fase 6.
2. **Fuentes definitivas:** confirmar Inter Display + Fraunces (gratis) o invertir en General Sans + PP Editorial New (comerciales, mejor acabado). Decisión recomendada antes de Fase 1 para no rehacer estilos.

---

## 29. Glosario

| Término | Significado |
|---|---|
| Clase | Curso completo. Slug único, acento, lockup, URL pública. |
| Módulo | Sección de una clase. Disponibilidad propia. |
| Contenido | Unidad atómica de información: texto, video, mapa, archivo, quiz. |
| Quiz | Evaluación. Vive como contenido pero detallado en tablas propias. |
| Attempt | Intento de un estudiante de presentar un quiz. |
| Grade item | Entrada calificable: viene de quiz o se ingresa manual. |
| Gradebook | Tabla consolidada de calificaciones. |
| Display name | Nombre amigable que el profesor asigna a un estudiante. |
| Lockup | Composición tipográfica italic serif + sans bold. Marca de la clase. |
| Acento | Color identificatorio de cada clase. Uno de 8 valores. |
| Session token | UUID generado al iniciar un intento. Detecta instancias paralelas. |
| Soft delete | Borrado lógico con `deleted_at`. Recuperable por 30 días. |
| Anonimización | Reemplazo de PII del estudiante preservando histórico de notas. |
| Optimistic locking | Control de concurrencia via campo `version`. |
| Auto-guardado | Persistencia automática de drafts con debounce. |
| PITR | Point-In-Time Recovery de Supabase. |
| OG image | Imagen Open Graph para previsualización al compartir. |
