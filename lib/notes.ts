import "server-only";

import { randomUUID } from "node:crypto";
import { db, initDb } from "@/lib/db";

export type NoteSummary = {
  id: string;
  title: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Note = NoteSummary & { content: string };

/**
 * The list query deliberately never selects `content` — a note body can be
 * 200k characters and the list renders none of it. `getNote` is the only
 * reader of the body. (No LIMIT: this is a single-person tool and the rows
 * are narrow columns; pagination would cost more than it saves.)
 *
 * The visibility filter runs in SQL — private titles never leave the
 * database for an anonymous request.
 */
export async function listNotes(includePrivate: boolean): Promise<NoteSummary[]> {
  await initDb();
  const result = await db().execute(
    includePrivate
      ? "SELECT id, title, is_public, created_at, updated_at FROM todo_notes ORDER BY updated_at DESC"
      : "SELECT id, title, is_public, created_at, updated_at FROM todo_notes WHERE is_public = 1 ORDER BY updated_at DESC",
  );
  return result.rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    isPublic: Number(r.is_public) === 1,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  }));
}

export async function getNote(id: string): Promise<Note | null> {
  await initDb();
  const result = await db().execute({
    sql: "SELECT id, title, content, is_public, created_at, updated_at FROM todo_notes WHERE id = ?",
    args: [id],
  });
  const r = result.rows[0];
  if (!r) return null;
  return {
    id: r.id as string,
    title: r.title as string,
    content: r.content as string,
    isPublic: Number(r.is_public) === 1,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

/**
 * New notes start public — the site's default posture; flip in the editor.
 * The defaults are the UI's whole call signature (`createNoteAction` passes
 * nothing); the API route passes explicit values. Validation stays with the
 * callers, same as every other writer here.
 */
export async function createNote(
  title = "untitled",
  content = "",
  isPublic = true,
): Promise<string> {
  await initDb();
  const id = randomUUID();
  const now = Date.now();
  await db().execute({
    sql: "INSERT INTO todo_notes (id, title, content, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, title, content, isPublic ? 1 : 0, now, now],
  });
  return id;
}

/**
 * Existence probe for the API's delete route: `deleteNote` is blind (a DELETE
 * of zero rows returns the same nothing), but the API must answer 404
 * truthfully. `getNote` would work too, at the cost of hauling a 200k body
 * across the wire to throw away.
 */
export async function noteExists(id: string): Promise<boolean> {
  await initDb();
  const result = await db().execute({
    sql: "SELECT 1 FROM todo_notes WHERE id = ?",
    args: [id],
  });
  return result.rows.length > 0;
}

export async function setNotePublic(id: string, isPublic: boolean): Promise<boolean> {
  await initDb();
  // Deliberately does not bump updated_at — flipping visibility is not an
  // edit, and the list orders by updated_at.
  const result = await db().execute({
    sql: "UPDATE todo_notes SET is_public = ? WHERE id = ?",
    args: [isPublic ? 1 : 0, id],
  });
  return result.rowsAffected > 0;
}

export type NotePatch = { title?: string; content?: string };

/**
 * Writes only the columns the patch names — saving a body can't clobber a
 * title edit that raced it, and vice versa. Same rule as hours' updateActual.
 */
export async function updateNote(id: string, patch: NotePatch): Promise<boolean> {
  await initDb();
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    args.push(patch.title);
  }
  if (patch.content !== undefined) {
    sets.push("content = ?");
    args.push(patch.content);
  }
  if (sets.length === 0) return true;
  sets.push("updated_at = ?");
  args.push(Date.now());
  args.push(id);
  const result = await db().execute({
    sql: `UPDATE todo_notes SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
  return result.rowsAffected > 0;
}

export async function deleteNote(id: string): Promise<void> {
  await initDb();
  await db().execute({ sql: "DELETE FROM todo_notes WHERE id = ?", args: [id] });
}
