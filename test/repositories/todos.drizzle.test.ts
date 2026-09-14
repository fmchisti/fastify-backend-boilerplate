import { createTodoRepository } from "../../src/modules/todos/repository/drizzle.ts";
import { startDrizzleTestDatabase } from "./drizzle-harness.ts";
import { describeTodoRepositoryContract } from "./todo-repository.contract.ts";

describeTodoRepositoryContract("drizzle", async () => {
  const { database, postgres } = await startDrizzleTestDatabase();
  return {
    repository: createTodoRepository(database),
    reset: () => postgres.truncate(["todos"]),
    close: async () => {
      await database.close();
      await postgres.stop();
    },
  };
});
