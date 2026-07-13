process.env.EPISODERA_SMOKE_ENV_FILE = ".env.smoke";
await import("./production-smoke.mjs");
