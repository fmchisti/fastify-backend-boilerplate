import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

export interface TestPostgres {
  url: string;
  /** Delete all rows from the given tables. */
  truncate(tables: string[]): Promise<void>;
  stop(): Promise<void>;
}

/**
 * In-process Postgres (PGlite) exposed over a TCP socket, so real drivers
 * (node-postgres, Prisma adapter) connect to it like any server. No Docker needed.
 * PGlite serves one connection at a time: use a pool with `max: 1`.
 */
export const startTestPostgres = async (migrationFiles: string[]): Promise<TestPostgres> => {
  const db = await PGlite.create();
  for (const file of migrationFiles) {
    await db.exec(await readFile(file, "utf8"));
  }

  const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const port = server.getServerConn().split(":").at(-1);

  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`,
    truncate: async (tables) => {
      await db.exec(`TRUNCATE ${tables.map((table) => `"${table}"`).join(", ")} CASCADE`);
    },
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
};
