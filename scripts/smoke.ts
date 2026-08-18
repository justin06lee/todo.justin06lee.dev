/**
 * End-to-end pass over the SQL layer against a throwaway file database —
 * the queries the unit tests can't cover (position subqueries, the
 * WHERE EXISTS orphan guard, the app-level cascade, partial note patches).
 *
 * Run through package.json (`bun run smoke`): the `--conditions=react-server`
 * flag it carries is load-bearing — these modules import `server-only`, which
 * throws unless the resolver picks its react-server entry the way Next does.
 * Same pattern as coffee.justin06lee.dev's smoke script.
 */
import { rmSync } from "node:fs";

process.env.TURSO_DATABASE_URL = "file:.data/smoke.db";
rmSync(".data/smoke.db", { force: true });

const { initDb } = await import("@/lib/db");
const todos = await import("@/lib/todos");
const notes = await import("@/lib/notes");

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`smoke: ${message}`);
}

await initDb();

// categories: create, unique name, position ordering
const a = await todos.createCategory("errands", "#6b8a72");
assert(a.ok, "createCategory failed");
const dup = await todos.createCategory("Errands", "#6b8a72");
assert(!dup.ok && dup.error === "name-taken", "case-insensitive unique name not enforced");
const b = await todos.createCategory("reading", "#5b7a8a");
assert(b.ok, "second createCategory failed");

// tasks: insert-if-parent-exists, position within category, toggle, rename
const t1 = await todos.createTask(a.id, "buy milk");
const t2 = await todos.createTask(a.id, "post letter");
assert(t1.ok && t2.ok, "createTask failed");
const orphan = await todos.createTask(crypto.randomUUID(), "ghost");
assert(!orphan.ok, "WHERE EXISTS guard let an orphan task in");

await todos.setTaskDone(t1.id, true);
await todos.renameTask(t2.id, "post the letter");

let board = await todos.listBoard();
assert(board.categories.length === 2, "expected 2 categories");
assert(board.categories[0].name === "errands", "category order broke");
const errands = board.tasks.filter((t) => t.categoryId === a.id);
assert(errands.length === 2, "expected 2 tasks in errands");
assert(errands[0].position === 0 && errands[1].position === 1, "task positions wrong");
assert(errands[0].done && errands[0].completedAt !== null, "done toggle didn't stick");
assert(errands[1].title === "post the letter", "rename didn't stick");

// clear completed, then the app-level cascade
const cleared = await todos.clearDoneTasks(a.id);
assert(cleared === 1, "clearDoneTasks removed the wrong count");
await todos.deleteCategory(a.id);
board = await todos.listBoard();
assert(board.categories.length === 1, "deleteCategory left the category");
assert(
  board.tasks.every((t) => t.categoryId !== a.id),
  "deleteCategory stranded tasks — the simulated cascade broke",
);

// notes: create, partial patches, list order, delete
const n1 = await notes.createNote();
const n2 = await notes.createNote();
assert(await notes.updateNote(n1, { title: "groceries" }), "title patch failed");
assert(await notes.updateNote(n1, { content: "# list\n\n- milk" }), "content patch failed");
const full = await notes.getNote(n1);
assert(full?.title === "groceries" && full.content.includes("milk"), "patch clobbered a column");
const listed = await notes.listNotes();
assert(listed.length === 2 && listed[0].id === n1, "notes not ordered by updated_at desc");
assert(!(await notes.updateNote(crypto.randomUUID(), { title: "x" })), "update of missing note reported found");
await notes.deleteNote(n1);
await notes.deleteNote(n2);
assert((await notes.listNotes()).length === 0, "deleteNote left rows");

rmSync(".data/smoke.db", { force: true });
console.log("smoke: all assertions passed");
process.exit(0);
