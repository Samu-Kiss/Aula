import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

const sentryEnabled = process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  // Don't upload source maps unless Sentry is explicitly enabled
  sourcemaps: {
    disable: !sentryEnabled,
    deleteSourcemapsAfterUpload: true,
  },
  // Disable auto-instrumentation — we init manually via instrumentation.ts
  webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
    autoInstrumentAppDirectory: false,
  },
});
