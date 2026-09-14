import { createAuthProvider } from "./auth/index.ts";
import type { AuthProvider } from "./auth/types.ts";
import { type AppDatabase, createDatabase, type Database } from "./db/index.ts";
import { createTodoRepository, type TodoRepository } from "./modules/todos/repository/index.ts";
import { createStorage, type StorageProvider } from "./storage/index.ts"; // @setup-if storage=s3,local

/**
 * Everything the app needs from the outside world.
 * `buildApp()` creates the selected implementations; tests pass fakes instead.
 * Add a field here when a new module needs a repository or external service.
 */
export interface AppDependencies {
  database: Database;
  auth: AuthProvider;
  todos: TodoRepository;
  // @gen:dependencies (pnpm gen:module inserts repositories above)
  // @setup-if storage=s3,local
  storage: StorageProvider;
  // @setup-endif
}

export interface DependencyConfig {
  corsOrigins: string[];
}

export const createDependencies = (
  overrides: Partial<AppDependencies>,
  config: DependencyConfig,
): AppDependencies => {
  // Created only if something below needs it, so tests with fakes never open a pool
  let database: AppDatabase | undefined;
  const getDatabase = (): AppDatabase => (database ??= createDatabase());

  return {
    auth: overrides.auth ?? createAuthProvider({ database: getDatabase, trustedOrigins: config.corsOrigins }),
    todos: overrides.todos ?? createTodoRepository(getDatabase()),
    // @gen:factories
    // @setup-if storage=s3,local
    storage: overrides.storage ?? createStorage(),
    // @setup-endif
    database: overrides.database ?? getDatabase(),
  };
};
