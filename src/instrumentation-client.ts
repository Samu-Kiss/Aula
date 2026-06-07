import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // PII scrubbing — drop user identity, keep only anonymous id
    beforeSend(event) {
      if (event.user) {
        event.user = { id: event.user.id };
      }
      return event;
    },
  });
}

export function onRouterTransitionStart(url: string) {
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true") {
    Sentry.addBreadcrumb({ category: "navigation", message: url, level: "info" });
  }
}
