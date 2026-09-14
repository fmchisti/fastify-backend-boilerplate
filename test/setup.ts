// Runs before every test file, before any app module is imported.
// Values set here win over `.env` because dotenv never overrides existing vars.
Object.assign(process.env, {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  BACKEND_URL: "http://localhost:3000",
  FRONTEND_URL: "http://localhost:5173",
  SUPABASE_URL: "https://test-project.supabase.co",
  SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_KEY: "test-service-key",
  DOCS_USERNAME: "docs",
  DOCS_PASSWORD: "pa:ss:word",
});
