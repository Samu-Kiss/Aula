# Criterios UX para futuras features — Plataforma Aula

> `F6-27` — Principios de decisión destilados de la revisión integral de UX (Fase 6).
> Complementa a `docs/ux-checklist.md` (instrumento de evaluación) y a `DESIGN.md`
> (sistema visual): este documento dice **cómo decidir**, el checklist dice **qué revisar**.

## 1. Toda feature nueva se evalúa con los dos roles

Profesor (dashboard) y estudiante (vista pública) tienen contextos distintos:
el profesor opera con sesión y confianza; el estudiante entra por un link, sin cuenta,
posiblemente desde un dispositivo compartido. Antes de dar por terminada una feature,
recorrer el flujo completo en ambos roles — los hallazgos bloqueantes de la Fase 6
(QR que apuntaba a un 404, evaluación publicada pero cerrada sin aviso) aparecieron
solo al cruzar la frontera profesor → estudiante.

## 2. El estado visible donde se decide, no donde se configura

Si una acción depende de un estado (publicado, disponible, ventana de fechas),
ese estado debe verse **junto al punto de acción**, no solo en la pantalla de
configuración. Ejemplos aplicados:

- El QR muestra el aviso "clase en borrador" al lado, no en Configuración.
- El QuizEditor muestra banner ámbar si la evaluación está publicada pero cerrada.
- El chip del header dice "Clase: borrador" (etiquetado, porque por posición se
  leía como estado del contenido actual).

Corolario: un chip de estado **informa**; si además ejecuta una acción, nadie la
descubre. Estado y acción van en controles separados (caso PublishModuleToggle).

## 3. Publicación jerárquica: avisar, no asumir

Clase, módulo y contenido se publican por separado. Cualquier feature que dependa
de visibilidad pública debe considerar el caso "el nivel padre está en borrador"
y avisarlo en el punto de uso. Nunca asumir que publicar un nivel publica la cadena.

## 4. Errores de datos nunca se disfrazan de estado vacío

Si una query falla (timeout, Supabase caído), mostrar error con opción de reintentar —
no el onboarding ni una lista vacía. Un profesor que ve "Crea tu primera clase"
teniendo cinco clases pierde más confianza que viendo "No se pudo cargar".
Patrón: distinguir `error` de `data.length === 0` en cada page server-side
(aplicado en `/dashboard` tras el hallazgo de Fase 6).

## 5. Acciones irreversibles: dos pasos; destructivas: reversibles

- Irreversible de cara al estudiante (entregar intento) → confirmación en dos pasos
  con aviso de irreversibilidad.
- Destructiva del profesor (eliminar clase/módulo/contenido) → soft delete + archivo
  de 30 días; el botón en borgoña, nunca con el estilo de las acciones neutras.

## 6. Acentos: índigo es plataforma, el acento del aula es identidad

- Dashboard: índigo para focus rings, botones de guardar, tabs, links de acción.
- Vista pública: el acento elegido por el profesor para lockup, QR, links, markers.
- Deuda consciente: la UI del intento de quiz usa índigo fijo; unificarla requiere
  acento dinámico vía CSS var. Si una feature nueva toca esa zona, resolverlo ahí.

## 7. Auditoría académica: el intento es un snapshot inmutable

Cualquier feature que toque preguntas o calificaciones debe respetar que el intento
conserva exactamente lo que el estudiante vio (`body_snapshot`). Editar una pregunta
no reescribe intentos pasados; ajustar una nota a mano deja rastro en el audit log.

## 8. Microcopy: español natural, imperativo, sin tecnicismos

Nada de "slug", "payload" o "status" de cara al estudiante. Mensajes de bloqueo
explican el porqué y el siguiente paso ("Tu profesor aún no ha abierto esta
evaluación. Vuelve a intentarlo más tarde."), nunca un genérico "no disponible".

## 9. Severidades y triage

Todo hallazgo se registra en el TODO con una de cuatro severidades:
**Bloqueante** (impide completar la tarea) · **Importante** (fricción notable o riesgo
de error) · **Deseable** (mejora clara, no urgente) · **Deuda visual** (cosmético).
Bloqueantes e importantes se arreglan antes de cerrar la fase; deseables y deuda
se registran con contexto suficiente para retomarlos sin re-investigar.

## 10. Limitaciones aceptadas (no re-litigar sin nueva información)

- `map_pin` no es completable por teclado (limitación de Mapbox GL).
- `datetime-local` muestra el formato del navegador (control nativo).
- El modal de proyección de QR no atrapa el foco (overlay informativo con cierre etiquetado).
- Param interno `?tab=quices` vs label "Por quiz" (cosmético, sin impacto de uso).

Si una feature nueva agrava alguna de estas (p. ej. más preguntas dependientes del
mapa), la limitación deja de ser aceptable y sube de severidad.
