import "server-only";

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient, type Client } from "@libsql/client";

/**
 * One client, three possible destinations — but only one code path.
 *
 * libsql speaks `file:` and `:memory:` with the same client and the same SQL,
 * so the no-credentials fallback is a connection string rather than a parallel
 * in-process store (which would be a second implementation of every query and
 * a second place for the two to disagree). A fresh clone runs with no env at
 * all and keeps its data between restarts; only the deployed-without-
 * credentials case forgets anything.
 *
 * The client is built on first use rather than at import: Next imports every
 * route to collect page data, and a module-scope client turns a missing
 * credential into a failed build instead of a failed request.
 */
let client: Client | null = null;
let ready: Promise<void> | null = null;

function url(): string {
  const turso = process.env.TURSO_DATABASE_URL;
  if (turso) return turso;

  // A serverless filesystem is read-only outside /tmp, so a file url in that
  // kind of production would fail on the first write rather than degrade.
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[todo] TURSO_DATABASE_URL unset in production — using an in-memory database. " +
        "notes, tasks and logins will not survive a restart.",
    );
    return ":memory:";
  }

  return "file:.data/todo.db";
}

export function db(): Client {
  if (!client) {
    const target = url();

    // libsql opens the file but won't create the directory holding it, and
    // the failure surfaces as a bare "code: 14" that says nothing about a
    // missing folder.
    if (target.startsWith("file:")) {
      mkdirSync(dirname(target.slice("file:".length)), { recursive: true });
    }

    client = createClient({ url: target, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

/**
 * Idempotent schema bootstrap, memoized per worker. Running the app migrates
 * the database — including `next dev` — so point TURSO_DATABASE_URL at
 * `file:./scratch.db` (or leave it unset for `.data/todo.db`) when you don't
 * want to touch the shared instance.
 *
 * Tables are namespaced `todo_` because the Turso database is shared with
 * every other justin06lee.dev site. Nothing here touches another site's
 * tables.
 *
 * The FK clause on todo_tasks is declarative only: libsql does not enable
 * PRAGMA foreign_keys per-connection, so the cascade is enforced at the app
 * level (deleteCategory batches the child deletes) and every task insert
 * validates its categoryId via categoryExists first.
 */
export async function initDb(): Promise<void> {
  ready ??= (async () => {
    await db().batch(
      [
        `CREATE TABLE IF NOT EXISTS todo_categories (
           id         TEXT PRIMARY KEY,
           name       TEXT NOT NULL,
           color      TEXT NOT NULL,
           position   INTEGER NOT NULL DEFAULT 0,
           is_public  INTEGER NOT NULL DEFAULT 1,
           created_at INTEGER NOT NULL,
           updated_at INTEGER NOT NULL
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_categories_name_lower
           ON todo_categories(LOWER(name))`,
        `CREATE TABLE IF NOT EXISTS todo_tasks (
           id           TEXT PRIMARY KEY,
           category_id  TEXT NOT NULL REFERENCES todo_categories(id) ON DELETE CASCADE,
           title        TEXT NOT NULL,
           done         INTEGER NOT NULL DEFAULT 0,
           position     INTEGER NOT NULL DEFAULT 0,
           created_at   INTEGER NOT NULL,
           updated_at   INTEGER NOT NULL,
           completed_at INTEGER
         )`,
        `CREATE INDEX IF NOT EXISTS idx_todo_tasks_category
           ON todo_tasks(category_id)`,
        `CREATE TABLE IF NOT EXISTS todo_notes (
           id         TEXT PRIMARY KEY,
           title      TEXT NOT NULL,
           content    TEXT NOT NULL DEFAULT '',
           is_public  INTEGER NOT NULL DEFAULT 1,
           created_at INTEGER NOT NULL,
           updated_at INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS todo_sessions (
           token      TEXT PRIMARY KEY,
           created_at INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS todo_login_attempts (
           ip            TEXT PRIMARY KEY,
           count         INTEGER NOT NULL,
           first_attempt INTEGER NOT NULL
         )`,
      ],
      "write",
    );

    // Additive migrations for tables that predate a column (the shared
    // database was bootstrapped before visibility existed). sqlite has no
    // ADD COLUMN IF NOT EXISTS, so the ALTER is attempted and the one
    // expected failure is swallowed. DDL strings are literals, never built
    // from input. DEFAULT 1: the site's posture is public-by-default,
    // private as the opt-in exception.
    await ensureColumn(
      "ALTER TABLE todo_categories ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1",
    );
    await ensureColumn(
      "ALTER TABLE todo_notes ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1",
    );
  })();
  return ready;
}

async function ensureColumn(ddl: string): Promise<void> {
  try {
    await db().execute(ddl);
  } catch (e) {
    if (e instanceof Error && e.message.includes("duplicate column name")) return;
    throw e;
  }
}
