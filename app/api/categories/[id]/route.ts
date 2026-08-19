import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, readJsonObject, requireAdmin } from "@/lib/api";
import { isPaletteColor } from "@/lib/colors";
import { MAX_CATEGORY_NAME_LEN, isRecordId, isTitleWithin } from "@/lib/validate";
import {
  categoryExists,
  deleteCategory,
  recolorCategory,
  renameCategory,
  setCategoryPublic,
} from "@/lib/todos";

export const dynamic = "force-dynamic";

/**
 * Partial update over the same per-field writers the actions use
 * (`renameCategory` / `recolorCategory` / `setCategoryPublic`). The actions
 * are blind-success on missing ids; the API checks existence first and
 * answers 404 truthfully.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isRecordId(id)) return jsonError("unknown category", 400);

  const body = await readJsonObject(req);
  if (!body) return jsonError("invalid JSON", 400);
  const { name, color, isPublic } = body;

  if (name !== undefined && !isTitleWithin(name, MAX_CATEGORY_NAME_LEN)) {
    return jsonError("enter a category name", 400);
  }
  if (color !== undefined && (typeof color !== "string" || !isPaletteColor(color))) {
    return jsonError("pick a palette color", 400);
  }
  if (isPublic !== undefined && typeof isPublic !== "boolean") {
    return jsonError("isPublic must be a boolean", 400);
  }

  if (!(await categoryExists(id))) return jsonError("category not found", 404);

  let changed = false;
  if (name !== undefined) {
    const result = await renameCategory(id, name.trim());
    if (!result.ok) return jsonError("that category already exists", 409);
    changed = true;
  }
  if (color !== undefined) {
    await recolorCategory(id, color);
    changed = true;
  }
  if (isPublic !== undefined) {
    await setCategoryPublic(id, isPublic);
    changed = true;
  }

  if (changed) revalidatePath("/");
  return NextResponse.json({ ok: true });
}

/** Deletes the category and (app-level cascade) its tasks. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isRecordId(id)) return jsonError("unknown category", 400);
  if (!(await categoryExists(id))) return jsonError("category not found", 404);

  const deletedTasks = await deleteCategory(id);
  revalidatePath("/");
  return NextResponse.json({ ok: true, deletedTasks });
}
