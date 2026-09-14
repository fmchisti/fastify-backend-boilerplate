/**
 * ORM-agnostic database handle.
 * `client` is the ORM client (Drizzle or Prisma); only repositories should touch it.
 */
export interface Database<TClient = unknown> {
  readonly client: TClient;
  /** Throws when the database is unreachable. Used by the readiness check. */
  ping(): Promise<void>;
  close(): Promise<void>;
}
