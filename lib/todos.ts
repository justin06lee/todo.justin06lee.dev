import "server-only";

import { randomUUID } from "node:crypto";
import { db, initDb } from "@/lib/db";

export type TodoCategory = {
  id: string;
  name: string;
  color: string;
  position: number;
  isPublic: boolean;
  createdAt: number;
};

export type TodoTask = {
  id: string;
  categoryId: string;
  title: string;
  done: boolean;
  position: number;
  createdAt: number;
  completedAt: number | null;
};

/**
 * libsql surfaces a violated UNIQUE index as SQLITE_CONSTRAINT; the message
 * carries the code whether or not the structured `code` property does, so
 * check both. Anything else is a real failure and re-throws at the call site.
 */
function isUniqueViolation(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const code = (e as { code?: string }).code ?? "";
  return code.includes("SQLITE_CONSTRAINT") || e.message.includes("SQLITE_CONSTRAINT");
}

export type CategoryWriteResult =
  | { ok: true; id: string }
  | { ok: false; error: "name-taken" };

/**
 * Everything the board renders, in one network round trip — `batch` sends both
 * statements together, and this page has no other backend, so sequential
 * `execute` hops are the whole latency budget. Rows come back ordered by
 * position (creation order): the board is "a big list of categories and tasks"
 * to reference, so it stays in the order it was written.
 *
 * Visibility is category-level and tasks inherit it, so the anonymous task
 * query filters through the parent — the flag lives in exactly one place and
 * a category flipped private takes its tasks with it atomically. The filter
 * happens here in SQL, not in the page: private rows never leave the database
 * for an anonymous request.
 */
export async function listBoard(includePrivate: boolean): Promise<{
  categories: TodoCategory[];
  tasks: TodoTask[];
}> {
  await initDb();
  const [cats, tasks] = await db().batch(
    includePrivate
      ? [
          "SELECT id, name, color, position, is_public, created_at FROM todo_categories ORDER BY position, created_at",
          "SELECT id, category_id, title, done, position, created_at, completed_at FROM todo_tasks ORDER BY position, created_at",
        ]
      : [
          "SELECT id, name, color, position, is_public, created_at FROM todo_categories WHERE is_public = 1 ORDER BY position, created_at",
          "SELECT id, category_id, title, done, position, created_at, completed_at FROM todo_tasks WHERE category_id IN (SELECT id FROM todo_categories WHERE is_public = 1) ORDER BY position, created_at",
        ],
    "read",
  );
  return {
    categories: cats.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      color: r.color as string,
      position: Number(r.position),
      isPublic: Number(r.is_public) === 1,
      createdAt: Number(r.created_at),
    })),
    tasks: tasks.rows.map((r) => ({
      id: r.id as string,
      categoryId: r.category_id as string,
      title: r.title as string,
      done: Number(r.done) === 1,
      position: Number(r.position),
      createdAt: Number(r.created_at),
      completedAt: r.completed_at === null ? null : Number(r.completed_at),
    })),
  };
}

export async function createCategory(
  name: string,
  color: string,
  isPublic: boolean,
): Promise<CategoryWriteResult> {
  await initDb();
  const id = randomUUID();
  const now = Date.now();
  try {
    // Position from a scalar subquery so a deleted category never re-hands its
    // slot out of order — the same reason oddjob's reference numbers come from
    // a counter rather than COUNT(*) + 1.
    await db().execute({
      sql: `INSERT INTO todo_categories (id, name, color, position, is_public, created_at, updated_at)
            SELECT ?, ?, ?, COALESCE(MAX(position) + 1, 0), ?, ?, ? FROM todo_categories`,
      args: [id, name, color, isPublic ? 1 : 0, now, now],
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "name-taken" };
    throw e;
  }
  return { ok: true, id };
}

export async function renameCategory(
  id: string,
  name: string,
): Promise<CategoryWriteResult> {
  await initDb();
  try {
    await db().execute({
      sql: "UPDATE todo_categories SET name = ?, updated_at = ? WHERE id = ?",
      args: [name, Date.now(), id],
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "name-taken" };
    throw e;
  }
  return { ok: true, id };
}

export async function setCategoryPublic(id: string, isPublic: boolean): Promise<void> {
  await initDb();
  // Deliberately does not bump updated_at — flipping visibility is not an
  // edit, and nothing should reorder because of it.
  await db().execute({
    sql: "UPDATE todo_categories SET is_public = ? WHERE id = ?",
    args: [isPublic ? 1 : 0, id],
  });
}

export async function recolorCategory(id: string, color: string): Promise<void> {
  await initDb();
  await db().execute({
    sql: "UPDATE todo_categories SET color = ?, updated_at = ? WHERE id = ?",
    args: [color, Date.now(), id],
  });
}

/**
 * Existence probes for the API routes. The server actions are deliberately
 * blind-success on missing ids (an UPDATE of zero rows is not an error the UI
 * can act on), but an HTTP API must answer 404 truthfully — so the routes read
 * before they write. Not needed by the actions; keep it that way.
 */
export async function categoryExists(id: string): Promise<boolean> {
  await initDb();
  const result = await db().execute({
    sql: "SELECT 1 FROM todo_categories WHERE id = ?",
    args: [id],
  });
  return result.rows.length > 0;
}

export async function taskExists(id: string): Promise<boolean> {
  await initDb();
  const result = await db().execute({
    sql: "SELECT 1 FROM todo_tasks WHERE id = ?",
    args: [id],
  });
  return result.rows.length > 0;
}

/**
 * Deletes the category and its tasks in one transaction. The DDL declares
 * ON DELETE CASCADE but libsql never enables PRAGMA foreign_keys, so the
 * cascade is simulated here — deleting only the category row would strand its
 * tasks invisibly, not blank them. Returns how many tasks the cascade took
 * with it (the board UI ignores this; the API reports it).
 */
export async function deleteCategory(id: string): Promise<number> {
  await initDb();
  const [tasks] = await db().batch(
    [
      { sql: "DELETE FROM todo_tasks WHERE category_id = ?", args: [id] },
      { sql: "DELETE FROM todo_categories WHERE id = ?", args: [id] },
    ],
    "write",
  );
  return tasks.rowsAffected;
}

/**
 * Insert-if-parent-exists in a single statement: the SELECT produces no row
 * when the category is gone, so the insert is a no-op instead of an orphan.
 * This is the app-level stand-in for the FK enforcement libsql doesn't run
 * (see §6 of the universe brief). Returns false when the category vanished.
 */
export async function createTask(
  categoryId: string,
  title: string,
): Promise<{ ok: boolean; id: string }> {
  await initDb();
  const id = randomUUID();
  const now = Date.now();
  const result = await db().execute({
    sql: `INSERT INTO todo_tasks (id, category_id, title, done, position, created_at, updated_at)
          SELECT ?, ?, ?, 0,
                 COALESCE((SELECT MAX(position) + 1 FROM todo_tasks WHERE category_id = ?), 0),
                 ?, ?
          WHERE EXISTS (SELECT 1 FROM todo_categories WHERE id = ?)`,
    args: [id, categoryId, title, categoryId, now, now, categoryId],
  });
  return { ok: result.rowsAffected > 0, id };
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  await initDb();
  const now = Date.now();
  await db().execute({
    sql: "UPDATE todo_tasks SET done = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    args: [done ? 1 : 0, done ? now : null, now, id],
  });
}

export async function renameTask(id: string, title: string): Promise<void> {
  await initDb();
  await db().execute({
    sql: "UPDATE todo_tasks SET title = ?, updated_at = ? WHERE id = ?",
    args: [title, Date.now(), id],
  });
}

export async function deleteTask(id: string): Promise<void> {
  await initDb();
  await db().execute({ sql: "DELETE FROM todo_tasks WHERE id = ?", args: [id] });
}

export async function clearDoneTasks(categoryId: string): Promise<number> {
  await initDb();
  const result = await db().execute({
    sql: "DELETE FROM todo_tasks WHERE category_id = ? AND done = 1",
    args: [categoryId],
  });
  return result.rowsAffected;
}
