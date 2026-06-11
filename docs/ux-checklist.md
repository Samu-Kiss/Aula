# Checklist heurístico UI/UX — Plataforma Aula

> `F6-22` — Instrumento de evaluación para las pruebas de la Fase 6 y para QA de futuras features.
> Basado en las 10 heurísticas de Nielsen, adaptado a los dos roles de la plataforma
> (profesor en dashboard, estudiante en vista pública) y al sistema visual definido en `DESIGN.md`.
>
> **Cómo usarlo:** recorrer cada sección sobre la pantalla o flujo bajo evaluación y marcar
> ✅ (cumple), ⚠️ (cumple parcialmente, anotar) o ❌ (no cumple, registrar en TODO con severidad).
> Severidades: **Bloqueante** (impide completar la tarea), **Importante** (fricción notable o
> riesgo de error), **Deseable** (mejora clara pero no urgente), **Deuda visual** (cosmético).

## 1. Visibilidad del estado del sistema

- [ ] Toda acción asíncrona muestra feedback inmediato (spinner, "Guardando…", botón deshabilitado).
- [ ] El autosave comunica su ciclo completo: pendiente → guardando → guardado.
- [ ] Los estados de publicación (borrador / publicado) y disponibilidad (abierto / cerrado / programado) son visibles donde se toman decisiones, no solo en configuración.
- [ ] El estudiante siempre sabe en qué estado está su intento (en progreso, enviado, calificado, revisión pendiente) y cuánto tiempo le queda.
- [ ] Las transiciones de página lentas muestran un estado de carga (`loading.tsx`), nunca pantalla congelada.
- [ ] Operaciones offline o con red caída se comunican y se recuperan al reconectar.

## 2. Coincidencia entre el sistema y el mundo real

- [ ] Microcopy en español natural e imperativo; sin tecnicismos (no "slug", "payload", "status" de cara al usuario final).
- [ ] La terminología es consistente en todo el producto: clase, módulo, contenido, quiz, intento, calificación (no mezclar sinónimos).
- [ ] Las fechas y horas se muestran en formato local legible; las ventanas de disponibilidad explican su efecto ("se abre el…", "cierra el…").
- [ ] Los porcentajes y notas usan la convención que espera un docente (escala clara, redondeo visible).

## 3. Control y libertad del usuario

- [ ] Toda pantalla tiene una salida obvia: breadcrumb, flecha de retorno o link "volver".
- [ ] Las acciones destructivas son reversibles (soft delete + archivo) o piden confirmación en dos pasos.
- [ ] Se puede cancelar la edición sin guardar (y se advierte si hay cambios sin guardar).
- [ ] Publicar es reversible (despublicar) y el efecto es inmediato y comprobable con el preview.
- [ ] El estudiante puede salir de un quiz y retomar el intento dentro de la ventana permitida.

## 4. Consistencia y estándares

- [ ] Cards, formularios, modales, tablas, badges y banners usan los componentes/patrones compartidos.
- [ ] Jerarquía de botones uniforme: primario oscuro (`bg-ink`), secundario outline, destructivo borgoña.
- [ ] El índigo es acento de plataforma (dashboard); el acento del aula se reserva para identidad pública (lockup, QR, links públicos, markers).
- [ ] Radios, espaciados y tipografía siguen los tokens de Tailwind del sistema visual.
- [ ] Iconografía de un solo set (lucide), tamaño y stroke consistentes.
- [ ] Títulos de pestaña descriptivos (`%s · Aula` / `%s · [clase]`) en cada ruta.

## 5. Prevención de errores

- [ ] Validación inline antes del submit, con el campo en error señalado y explicado.
- [ ] Restricciones del dominio comunicadas antes de chocar con ellas (título 3–80 chars, pesos que deben sumar 100, ventanas de fechas coherentes).
- [ ] No se puede compartir/proyectar el QR de una clase en borrador sin un aviso claro.
- [ ] Las acciones irreversibles de cara al estudiante (enviar intento) piden confirmación explícita.
- [ ] Los límites de intentos y el control de duplicados están protegidos en servidor, no solo en UI.

## 6. Reconocimiento antes que recuerdo

- [ ] La navegación muestra dónde estoy: sección activa resaltada, breadcrumbs, lockup de la clase en el header.
- [ ] Las listas muestran el contexto necesario para decidir sin abrir el detalle (estado, fecha, conteos).
- [ ] Los formularios precargan los valores actuales al editar.
- [ ] Acciones disponibles visibles (no escondidas tras hover en pantallas táctiles).

## 7. Flexibilidad y eficiencia de uso

- [ ] Flujos frecuentes en pocos pasos: crear contenido desde el módulo, calificar desde la notificación, duplicar clase/módulo/quiz.
- [ ] Drag & drop para reordenar tiene alternativa accesible (botones subir/bajar o equivalente por teclado).
- [ ] El gradebook permite edición inline sin abrir páginas intermedias.
- [ ] Export CSV y QR descargable funcionan en un clic.

## 8. Diseño estético y minimalista

- [ ] Cada pantalla tiene una acción primaria clara; lo secundario no compite visualmente.
- [ ] Sin información redundante ni chrome innecesario; los estados vacíos enseñan el siguiente paso (CTA).
- [ ] La jerarquía tipográfica (eyebrow → h1 → cuerpo) se mantiene en dashboard y público.

## 9. Ayuda a reconocer, diagnosticar y recuperarse de errores

- [ ] Mensajes de error en lenguaje claro: qué pasó, por qué y qué hacer ahora.
- [ ] Errores de red/servidor distinguibles de estados vacíos (un fallo de datos nunca se disfraza de "no hay elementos").
- [ ] 404/500 públicas con navegación de regreso.
- [ ] El estudiante que pierde la sesión o el código de verificación tiene un camino de recuperación evidente.

## 10. Ayuda y documentación

- [ ] Ayudas contextuales (hints bajo los campos, tooltips) donde la decisión no es obvia.
- [ ] El onboarding del profesor nuevo guía hasta la primera clase publicada.
- [ ] El flujo de identificación del estudiante explica qué se hace con su correo.

## 11. Responsive (complemento F6-18)

- [ ] **Breakpoints de referencia:** 375px (móvil), 768px (tablet), 1280px+ (desktop).
- [ ] Sin scroll horizontal en ninguna ruta a 375px.
- [ ] Tablas anchas (gradebook, intentos) tienen estrategia móvil: scroll interno señalizado, columnas prioritarias o cards apiladas.
- [ ] Sidebars colapsan o se reordenan en móvil sin perder acceso a las secciones.
- [ ] El editor de contenido y el quiz son usables en tablet (caso real: profesor con iPad, estudiante con celular).
- [ ] Imágenes, mapas y videos embebidos escalan sin desbordar su contenedor.
- [ ] Modales y panels laterales caben en viewport móvil y permiten cerrar sin scroll.

## 12. Accesibilidad (complemento F6-19/20)

- [ ] **Automático:** 0 violaciones críticas/serias de axe-core en las rutas principales.
- [ ] Contraste AA: texto normal ≥ 4.5:1, texto grande ≥ 3:1 (ojo con texto sobre el acento del aula, que es variable).
- [ ] Foco visible en todo elemento interactivo; orden de tabulación lógico; sin trampas de foco en modales.
- [ ] Todo control tiene label asociado o `aria-label`; los iconos-botón tienen nombre accesible.
- [ ] Estructura semántica: un `h1` por página, jerarquía de headings sin saltos, landmarks (`nav`, `main`).
- [ ] Imágenes con `alt` (o `alt=""` decorativo); el QR tiene alternativa textual (la URL visible).
- [ ] Estados dinámicos anunciados (`role="status"`/`aria-live` para autosave, timer y alertas del intento).
- [ ] El quiz es completable solo con teclado, incluida la selección de opciones (y `map_pin` documenta su limitación si no lo es).

## 13. Tap targets y uso en pantalla pequeña (complemento F6-21)

- [ ] Objetivos táctiles ≥ 44×44 px (o área efectiva equivalente con padding) en vista pública y dashboard móvil.
- [ ] Separación mínima entre targets adyacentes (≥ 8px) para evitar toques erróneos.
- [ ] Acciones por hover tienen equivalente táctil (tap muestra acciones, long-press no requerido).
- [ ] Inputs con `font-size ≥ 16px` en móvil (evita zoom forzado de iOS).
- [ ] El teclado virtual no tapa el campo activo ni el botón de envío en formularios críticos (identificación, quiz).

---

### Registro de resultados

| Fecha | Pantalla/Flujo | Evaluador | Bloqueantes | Importantes | Deseables | Notas |
|-------|----------------|-----------|-------------|-------------|-----------|-------|
|       |                |           |             |             |           |       |

Los hallazgos se registran en `TODO` (sección Fase 6) con el formato de las revisiones 6.1–6.4:
severidad en negrita, descripción del problema, y → recomendación o fix aplicado.
