import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, readJsonObject, requireAdmin } from "@/lib/api";
import { MAX_TASK_TITLE_LEN, isRecordId, isTitleWithin } from "@/lib/validate";
import { deleteTask, renameTask, setTaskDone, taskExists } from "@/lib/todos";

export const dynamic = "force-dynamic";

/**
 * Partial update over the same writers the actions use (`renameTask` /
 * `setTaskDone`), with the truthful 404 the blind actions don't give.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isRecordId(id)) return jsonError("unknown task", 400);

  const body = await readJsonObject(req);
  if (!body) return jsonError("invalid JSON", 400);
  const { title, done } = body;

  if (title !== undefined && !isTitleWithin(title, MAX_TASK_TITLE_LEN)) {
    return jsonError("enter a task", 400);
  }
  if (done !== undefined && typeof done !== "boolean") {
    return jsonError("done must be a boolean", 400);
  }

  if (!(await taskExists(id))) return jsonError("task not found", 404);

  let changed = false;
  if (title !== undefined) {
    await renameTask(id, title.trim());
    changed = true;
  }
  if (done !== undefined) {
    await setTaskDone(id, done);
    changed = true;
  }

  if (changed) revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isRecordId(id)) return jsonError("unknown task", 400);
  if (!(await taskExists(id))) return jsonError("task not found", 404);

  await deleteTask(id);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
