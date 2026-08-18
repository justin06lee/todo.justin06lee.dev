"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  SESSION_COOKIE_NAME,
  checkRateLimit,
  createSession,
  destroySession,
  getClientIp,
  verifyAdminKey,
} from "@/lib/auth";
import { isAdminServer } from "@/lib/auth-server";
import { isPaletteColor } from "@/lib/colors";
import {
  MAX_CATEGORY_NAME_LEN,
  MAX_NOTE_CONTENT_LEN,
  MAX_NOTE_TITLE_LEN,
  MAX_TASK_TITLE_LEN,
  isContentWithin,
  isRecordId,
  isTitleWithin,
} from "@/lib/validate";
import {
  clearDoneTasks,
  createCategory,
  createTask,
  deleteCategory,
  deleteTask,
  recolorCategory,
  renameCategory,
  renameTask,
  setCategoryPublic,
  setTaskDone,
} from "@/lib/todos";
import { createNote, deleteNote, setNotePublic, updateNote } from "@/lib/notes";

/**
 * Server Actions are reachable by direct POST, not only through this UI, so
 * every mutating action re-checks admin rather than trusting that the page
 * that rendered the button was itself gated. (Layouts don't protect server
 * actions — §7 of the universe brief.)
 */
async function assertAdmin() {
  if (!(await isAdminServer())) throw new Error("unauthorized");
}

/**
 * Expected failures come back as values rather than throws: Next masks thrown
 * error messages in production, so a thrown "that category already exists"
 * would reach the UI as a generic error. Callers that feed InlineEdit convert
 * an `ok: false` back into a local throw to trigger its rollback.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

const OK: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

/* ── auth ── */

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    // Deliberately ahead of the rate limit: an empty field is a UI slip, not a
    // guess, and it never reaches the compare, so it shouldn't burn an attempt.
    return { error: "enter the password" };
  }

  // Brute-force gate. This action is the only login surface in the app — no
  // middleware, no proxy, no route handlers — so with nothing here an attacker
  // scripts unlimited guesses against ADMIN_KEY at line speed. The limit runs
  // *before* verifyAdminKey so a locked-out caller learns nothing about
  // whether the guess it just sent was right. A request whose IP can't be
  // determined buckets to "unknown" and that shared counter is enforced like
  // any other — skipping it would be a one-header bypass of the whole control.
  const ip = await getClientIp();
  if (!(await checkRateLimit(ip))) {
    return { error: "too many attempts" };
  }

  // Constant-time compare lives in verifyAdminKey.
  if (!verifyAdminKey(password)) {
    return { error: "wrong password" };
  }

  const token = await createSession();
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
  });
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) await destroySession(token);
  store.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

/* ── categories ── */

export async function createCategoryAction(
  name: string,
  color: string,
  isPublic: boolean,
): Promise<ActionResult> {
  await assertAdmin();
  if (!isTitleWithin(name, MAX_CATEGORY_NAME_LEN)) return fail("enter a category name");
  if (!isPaletteColor(color)) return fail("pick a palette color");
  const result = await createCategory(name.trim(), color, isPublic === true);
  if (!result.ok) return fail("that category already exists");
  revalidatePath("/");
  return OK;
}

export async function setCategoryPublicAction(
  id: string,
  isPublic: boolean,
): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(id)) return fail("unknown category");
  await setCategoryPublic(id, isPublic === true);
  revalidatePath("/");
  return OK;
}

export async function renameCategoryAction(
  id: string,
  name: string,
): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(id)) return fail("unknown category");
  if (!isTitleWithin(name, MAX_CATEGORY_NAME_LEN)) return fail("enter a category name");
  const result = await renameCategory(id, name.trim());
  if (!result.ok) return fail("that category already exists");
  revalidatePath("/");
  return OK;
}

export async function recolorCategoryAction(
  id: string,
  color: string,
): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(id)) return fail("unknown category");
  if (!isPaletteColor(color)) return fail("pick a palette color");
  await recolorCategory(id, color);
  revalidatePath("/");
  return OK;
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(id)) return fail("unknown category");
  await deleteCategory(id);
  revalidatePath("/");
  return OK;
}

export async function clearDoneTasksAction(categoryId: string): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(categoryId)) return fail("unknown category");
  await clearDoneTasks(categoryId);
  revalidatePath("/");
  return OK;
}

/* ── tasks ── */

export async function createTaskAction(
  categoryId: string,
  title: string,
): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(categoryId)) return fail("unknown category");
  if (!isTitleWithin(title, MAX_TASK_TITLE_LEN)) return fail("enter a task");
  const result = await createTask(categoryId, title.trim());
  // rowsAffected 0 means the category was deleted under us (another tab, the
  // shared database) — say so instead of silently dropping the task.
  if (!result.ok) return fail("that category no longer exists");
  revalidatePath("/");
  return OK;
}

export async function setTaskDoneAction(id: string, done: boolean): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(id)) return fail("unknown task");
  await setTaskDone(id, done === true);
  revalidatePath("/");
  return OK;
}

export async function renameTaskAction(id: string, title: string): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(id)) return fail("unknown task");
  if (!isTitleWithin(title, MAX_TASK_TITLE_LEN)) return fail("enter a task");
  await renameTask(id, title.trim());
  revalidatePath("/");
  return OK;
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(id)) return fail("unknown task");
  await deleteTask(id);
  revalidatePath("/");
  return OK;
}

/* ── notes ── */

export async function createNoteAction(): Promise<void> {
  await assertAdmin();
  const id = await createNote();
  revalidatePath("/notes");
  redirect(`/notes/${id}`);
}

export async function renameNoteAction(id: string, title: string): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(id)) return fail("unknown note");
  if (!isTitleWithin(title, MAX_NOTE_TITLE_LEN)) return fail("enter a title");
  const found = await updateNote(id, { title: title.trim() });
  if (!found) return fail("this note was deleted");
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  return OK;
}

export async function setNotePublicAction(
  id: string,
  isPublic: boolean,
): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(id)) return fail("unknown note");
  const found = await setNotePublic(id, isPublic === true);
  if (!found) return fail("this note was deleted");
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  return OK;
}

export async function saveNoteAction(id: string, content: string): Promise<ActionResult> {
  await assertAdmin();
  if (!isRecordId(id)) return fail("unknown note");
  if (!isContentWithin(content, MAX_NOTE_CONTENT_LEN)) {
    return fail("this note is too long to save");
  }
  const found = await updateNote(id, { content });
  if (!found) return fail("this note was deleted");
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  return OK;
}

export async function deleteNoteAction(id: string): Promise<void> {
  await assertAdmin();
  if (!isRecordId(id)) redirect("/notes");
  await deleteNote(id);
  revalidatePath("/notes");
  redirect("/notes");
}
