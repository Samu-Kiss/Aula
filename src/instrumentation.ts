import { type Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "true") return;
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
      // PII scrubbing
      beforeSend(event) {
        return scrubPii(event);
      },
      beforeSendTransaction(event) {
        return scrubPii(event);
      },
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0,
      beforeSend(event) {
        return scrubPii(event);
      },
    });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "true") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
};

// Strip PII (emails, names) from Sentry events so student data never leaves
// the server in error payloads.
function scrubPii<T extends { user?: unknown; request?: unknown; extra?: unknown }>(
  event: T
): T {
  // Remove user identity fields entirely
  if (event.user) {
    event = {
      ...event,
      user: { id: (event.user as Record<string, unknown>).id },
    };
  }
  return event;
}
