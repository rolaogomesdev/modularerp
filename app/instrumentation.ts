import * as Sentry from "@sentry/nextjs";

// Env-gated: without SENTRY_DSN this is a no-op. DSN comes from Vercel envs
// once the Sentry project exists (ROADMAP follow-up).
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    enableLogs: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
