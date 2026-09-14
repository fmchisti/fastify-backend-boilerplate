import { createTodoRepository } from "../../src/modules/todos/repository/prisma.ts";
import { startPrismaTestDatabase } from "./prisma-harness.ts";
import { describeTodoRepositoryContract } from "./todo-repository.contract.ts";

describeTodoRepositoryContract("prisma", async () => {
  const { database, postgres } = await startPrismaTestDatabase();
  return {
    repository: createTodoRepository(database),
    reset: () => postgres.truncate(["todos"]),
    close: async () => {
      await database.close();
      await postgres.stop();
    },
  };
});
