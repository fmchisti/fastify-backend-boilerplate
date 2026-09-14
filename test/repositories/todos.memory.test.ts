import { createMemoryTodoRepository } from "../fakes/todo-repository.ts";
import { describeTodoRepositoryContract } from "./todo-repository.contract.ts";

// Keeps the in-memory fake honest: route tests rely on it behaving like the real repositories
describeTodoRepositoryContract("memory fake", async () => {
  let repository = createMemoryTodoRepository();
  return {
    get repository() {
      return repository;
    },
    reset: async () => {
      repository = createMemoryTodoRepository();
    },
    close: async () => undefined,
  };
});
