import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// Sem SENTRY_AUTH_TOKEN (upload de sourcemap), o build funciona igual, só
// não sobe sourcemap pro Sentry — erros ainda chegam, só com stack minificada.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  telemetry: false,
});
