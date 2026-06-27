/**
 * Minimal structural interface for a libSQL/Turso client, capturing only what
 * the normalized storage layer uses. Keeping it here means the shared storage
 * modules never import a platform-specific client (`@libsql/client/web` vs
 * `@libsql/client`), so they stay testable with a plain mock.
 */

/** Values libSQL accepts as bound arguments. */
export type SqlValue = string | number | bigint | boolean | null | Uint8Array;

export type SqlStatement = {
  sql: string;
  args?: SqlValue[];
};

export type SqlRow = Record<string, unknown>;

export type SqlResultSet = {
  rows: SqlRow[];
  rowsAffected?: number;
};

export interface SqlClient {
  execute(statement: string | SqlStatement): Promise<SqlResultSet>;
  batch(
    statements: Array<string | SqlStatement>,
    mode?: 'write' | 'read' | 'deferred'
  ): Promise<SqlResultSet[]>;
}
