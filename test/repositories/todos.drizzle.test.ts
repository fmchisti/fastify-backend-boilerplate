import { readdir } from "node:fs/promises";
import path from "node:path";
import { createDatabase } from "../../src/db/drizzle/index.ts";
import { createTodoRepository } from "../../src/modules/todos/repository/drizzle.ts";
import { startTestPostgres } from "../postgres.ts";
import { describeTodoRepositoryContract } from "./todo-repository.contract.ts";

describeTodoRepositoryContract("drizzle", async () => {
  const dir = path.resolve("drizzle");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  const postgres = await startTestPostgres(files.map((file) => path.join(dir, file)));
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
