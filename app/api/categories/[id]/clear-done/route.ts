import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, requireAdmin } from "@/lib/api";
import { isRecordId } from "@/lib/validate";
import { categoryExists, clearDoneTasks } from "@/lib/todos";

export const dynamic = "force-dynamic";

/** HTTP twin of `clearDoneTasksAction`, reporting how many rows it removed. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isRecordId(id)) return jsonError("unknown category", 400);
  if (!(await categoryExists(id))) return jsonError("category not found", 404);

  const cleared = await clearDoneTasks(id);
  revalidatePath("/");
  return NextResponse.json({ ok: true, cleared });
}
