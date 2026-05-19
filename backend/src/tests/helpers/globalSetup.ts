import * as Sentry from "@sentry/node";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long-ok";

Sentry.init({ enabled: false });
