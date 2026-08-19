import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, readJsonObject, requireAdmin } from "@/lib/api";
import { MAX_TASK_TITLE_LEN, isRecordId, isTitleWithin } from "@/lib/validate";
import { createTask } from "@/lib/todos";

export const dynamic = "force-dynamic";

/**
 * HTTP twin of `createTaskAction`. `createTask` is insert-if-parent-exists,
 * so a vanished category comes back as a 404 rather than an orphan row.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJsonObject(req);
  if (!body) return jsonError("invalid JSON", 400);
  const { categoryId, title } = body;

  if (!isRecordId(categoryId)) return jsonError("unknown category", 400);
  if (!isTitleWithin(title, MAX_TASK_TITLE_LEN)) return jsonError("enter a task", 400);

  const result = await createTask(categoryId, title.trim());
  if (!result.ok) return jsonError("that category no longer exists", 404);

  revalidatePath("/");
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
