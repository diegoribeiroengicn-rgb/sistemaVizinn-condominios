import * as Sentry from "@sentry/nextjs";

// DSN vem de uma conta Sentry gratuita (sentry.io) — sem ela, enabled:false
// e o app funciona exatamente como antes, sem captura de erro nenhuma.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
});
