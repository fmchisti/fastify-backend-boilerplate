import type { Database } from "../../src/db/types.ts";

export interface FakeDatabase extends Database<null> {
  healthy: boolean;
}

export const createFakeDatabase = (): FakeDatabase => {
  const database: FakeDatabase = {
    client: null,
    healthy: true,
    ping: async () => {
      if (!database.healthy) throw new Error("connection refused");
    },
    close: async () => undefined,
  };
  return database;
};
