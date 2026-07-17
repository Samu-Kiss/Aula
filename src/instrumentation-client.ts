import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
    // Session Replay — maskAllText/blockAllMedia protegen datos de estudiantes
    // en la grabación (coherente con el scrubbing de PII de beforeSend).
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // 10% de las sesiones normales; 100% de las sesiones con error.
    replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    // PII scrubbing — drop user identity, keep only anonymous id
    beforeSend(event) {
      if (event.user) {
        event.user = { id: event.user.id };
      }
      return event;
    },
  });
}

// Hook oficial de navegación (App Router); solo cuando Sentry está activo.
export function onRouterTransitionStart(url: string, navigationType: string) {
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true") {
    Sentry.captureRouterTransitionStart(url, navigationType);
  }
}
