// Runs before every test file, before any app module is imported.
// Values set here win over `.env` because dotenv never overrides existing vars.
// Only core env is set: providers are replaced with fakes (see test/fakes).
Object.assign(process.env, {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  FRONTEND_URL: "http://localhost:5173",
  DOCS_USERNAME: "docs",
  DOCS_PASSWORD: "pa:ss:word",
});
