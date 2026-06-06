# Dev Setup

Dos terminales: una para Supabase, otra para Next.js.

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop) instalado y corriendo
- Node.js 20+

## Levantar el backend (Supabase local)

```bash
npx supabase start
```

La primera vez descarga imágenes Docker (~1-2 min). Al terminar imprime las claves locales.

### Configurar `.env.local`

Copia los valores que imprimió `supabase start`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
STUDENT_JWT_SECRET=dev-secret-aula-2026-cambiar-en-produccion
```

### Aplicar migraciones

```bash
npx supabase db push
```

### Crear usuario de profesor

Abre Supabase Studio → **Authentication → Users → Add user**.

## Levantar el frontend (Next.js)

```bash
npm run dev
```

## URLs

| Qué | URL |
|---|---|
| App | http://localhost:3000 |
| Login | http://localhost:3000/login |
| Supabase Studio | http://127.0.0.1:54323 |
| Supabase API | http://127.0.0.1:54321 |

## Detener todo

```bash
# Ctrl+C en la terminal del frontend, luego:
npx supabase stop
```
