import { readdir } from "node:fs/promises";
import path from "node:path";
import { createDatabase } from "../../src/db/prisma/index.ts";
import { createTodoRepository } from "../../src/modules/todos/repository/prisma.ts";
import { startTestPostgres } from "../postgres.ts";
import { describeTodoRepositoryContract } from "./todo-repository.contract.ts";

describeTodoRepositoryContract("prisma", async () => {
  const dir = path.resolve("prisma/migrations");
  const migrations = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name, "migration.sql"))
    .sort();
  const postgres = await startTestPostgres(migrations);
  const database = createDatabase(postgres.url, { max: 1 });

  return {
    repository: createTodoRepository(database),
    reset: () => postgres.truncate(["todos"]),
    close: async () => {
      await database.close();
      await postgres.stop();
    },
  };
});
