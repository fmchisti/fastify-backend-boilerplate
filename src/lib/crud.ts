import type { Page, PaginationQuery } from "./pagination.ts";

/**
 * Standard data access for a user-owned resource. Every method is scoped to `userId`.
 * Modules created with `pnpm gen:module` implement this once per ORM.
 */
export interface CrudRepository<TEntity, TCreate, TUpdate> {
  list(userId: string, query: PaginationQuery): Promise<Page<TEntity>>;
  findById(userId: string, id: string): Promise<TEntity | null>;
  create(userId: string, input: TCreate): Promise<TEntity>;
  /** Returns `null` when the record does not exist for this user. */
  update(userId: string, id: string, input: TUpdate): Promise<TEntity | null>;
  /** Returns `false` when the record does not exist for this user. */
  delete(userId: string, id: string): Promise<boolean>;
}

/** Standard data access for a public resource (not owned by a user). */
export interface PublicCrudRepository<TEntity, TCreate, TUpdate> {
  list(query: PaginationQuery): Promise<Page<TEntity>>;
  findById(id: string): Promise<TEntity | null>;
  create(input: TCreate): Promise<TEntity>;
  /** Returns `null` when the record does not exist. */
  update(id: string, input: TUpdate): Promise<TEntity | null>;
  /** Returns `false` when the record does not exist. */
  delete(id: string): Promise<boolean>;
}

type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/** Drops keys whose value is `undefined`, so partial updates only touch provided fields. */
export const withoutUndefined = <T extends object>(value: T): Defined<T> => {
  const result: Defined<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    const item = value[key];
    if (item !== undefined) result[key] = item as Exclude<T[keyof T], undefined>;
  }
  return result;
};
