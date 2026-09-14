import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CrudRepository } from "../../src/lib/crud.ts";

export interface CrudHarness<TEntity, TCreate, TUpdate> {
  repository: CrudRepository<TEntity, TCreate, TUpdate>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const MISSING_ID = "00000000-0000-4000-8000-000000000000";
// Rows created in the same millisecond tie on created_at (then order by id), so space them out
const tick = () => new Promise((resolve) => setTimeout(resolve, 3));

/**
 * Behaviour every CrudRepository must have, regardless of ORM.
 * `create` and `update` are valid domain inputs (e.g. `CreateXBodySchema.parse(sample)`).
 */
export const describeCrudRepositoryContract = <
  TEntity extends Entity,
  TCreate extends object,
  TUpdate extends object,
>(
  name: string,
  createHarness: () => Promise<CrudHarness<TEntity, TCreate, TUpdate>>,
  samples: { create: TCreate; update: TUpdate },
) => {
  describe(`CrudRepository contract: ${name}`, () => {
    let harness: CrudHarness<TEntity, TCreate, TUpdate>;
    const repo = () => harness.repository;

    beforeAll(async () => {
      harness = await createHarness();
    });
    beforeEach(() => harness.reset());
    afterAll(() => harness.close());

    it("creates a record with id, timestamps, and the given fields", async () => {
      const created = await repo().create("alice", samples.create);

      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
      expect(created).toMatchObject(samples.create);
    });

    it("finds by id only for the owner", async () => {
      const created = await repo().create("alice", samples.create);

      expect(await repo().findById("alice", created.id)).toEqual(created);
      expect(await repo().findById("bob", created.id)).toBeNull();
      expect(await repo().findById("alice", MISSING_ID)).toBeNull();
    });

    it("lists newest first with pagination and totals, scoped to the owner", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        ids.push((await repo().create("alice", samples.create)).id);
        await tick();
      }
      await repo().create("bob", samples.create);

      const first = await repo().list("alice", { page: 1, pageSize: 2 });
      expect(first.total).toBe(3);
      expect(first.items.map((item) => item.id)).toEqual([ids[2], ids[1]]);

      const second = await repo().list("alice", { page: 2, pageSize: 2 });
      expect(second.items.map((item) => item.id)).toEqual([ids[0]]);

      expect(await repo().list("carol", { page: 1, pageSize: 20 })).toEqual({ items: [], total: 0 });
    });

    it("updates provided fields only for the owner", async () => {
      const created = await repo().create("alice", samples.create);

      expect(await repo().update("bob", created.id, samples.update)).toBeNull();

      const updated = await repo().update("alice", created.id, samples.update);
      expect(updated).toMatchObject(samples.update);
      expect(updated?.id).toBe(created.id);
      expect(await repo().findById("alice", created.id)).toMatchObject(samples.update);
      expect(await repo().update("alice", MISSING_ID, samples.update)).toBeNull();
    });

    it("deletes only for the owner", async () => {
      const created = await repo().create("alice", samples.create);

      expect(await repo().delete("bob", created.id)).toBe(false);
      expect(await repo().delete("alice", created.id)).toBe(true);
      expect(await repo().findById("alice", created.id)).toBeNull();
      expect(await repo().delete("alice", created.id)).toBe(false);
    });
  });
};
