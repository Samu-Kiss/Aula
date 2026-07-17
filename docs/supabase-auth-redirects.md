# Recuperación de contraseña — configuración de redirects en Supabase

## Por qué el enlace redirigía a Vercel

Los correos de Supabase Auth (recuperación de contraseña, magic link) construyen
su enlace con el **Site URL** del proyecto. Si en el dashboard de Supabase el
Site URL apunta al dominio `*.vercel.app` (o quedó el valor por defecto), el
enlace termina ahí, sin importar desde dónde se pidió el reset. Además, si el
`redirectTo` que manda la app no está en la allow-list de **Redirect URLs**,
Supabase lo ignora y cae de vuelta al Site URL.

## Flujo implementado en la app

1. `/login/recuperar` — el profesor pide el enlace (`resetPasswordForEmail` con
   `redirectTo = {NEXT_PUBLIC_APP_URL}/auth/confirm?next=/restablecer-contrasena`).
2. `/auth/confirm` — route handler que acepta tanto `?code=` (flujo PKCE por
   defecto) como `?token_hash=&type=` (plantilla personalizada), deja la sesión
   en cookies y redirige a `next`.
3. `/restablecer-contrasena` — con la sesión ya iniciada, define la contraseña
   nueva (`auth.updateUser`). La misma página sirve como "Cambiar contraseña"
   desde el header del dashboard.

## Qué configurar en el dashboard de Supabase (proyecto hosted)

En **Authentication → URL Configuration**:

- **Site URL**: la URL canónica de producción, p. ej.
  `https://<tu-proyecto>.vercel.app` (o el dominio propio cuando exista).
- **Redirect URLs** (agregar todas):
  - `https://<tu-proyecto>.vercel.app/**`
  - `http://localhost:3000/**` (para probar contra el proyecto hosted en local)

En **Vercel → Settings → Environment Variables**:

- `NEXT_PUBLIC_APP_URL=https://<tu-proyecto>.vercel.app` — es la base del
  `redirectTo`; si queda en `http://localhost:3000`, el enlace de producción
  intentará volver a localhost.

> Los previews de Vercel (`*-git-*.vercel.app`) también necesitan estar en la
> allow-list si se quiere probar el flujo ahí; se puede usar el comodín
> `https://*-<tu-scope>.vercel.app/**`.

## Local (supabase start)

`supabase/config.toml` ya incluye `http://localhost:3000/**` en
`additional_redirect_urls`. Los correos locales no se envían: se ven en
Inbucket (`http://127.0.0.1:54324`). Tras cambiar el config hace falta
`supabase stop && supabase start`.
