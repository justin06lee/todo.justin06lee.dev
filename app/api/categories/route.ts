import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, readJsonObject, requireAdmin } from "@/lib/api";
import { isPaletteColor } from "@/lib/colors";
import { MAX_CATEGORY_NAME_LEN, isTitleWithin } from "@/lib/validate";
import { createCategory } from "@/lib/todos";

export const dynamic = "force-dynamic";

/** HTTP twin of `createCategoryAction` — same validation, same revalidation. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJsonObject(req);
  if (!body) return jsonError("invalid JSON", 400);
  const { name, color, isPublic } = body;

  if (!isTitleWithin(name, MAX_CATEGORY_NAME_LEN)) {
    return jsonError("enter a category name", 400);
  }
  if (typeof color !== "string" || !isPaletteColor(color)) {
    return jsonError("pick a palette color", 400);
  }
  if (isPublic !== undefined && typeof isPublic !== "boolean") {
    return jsonError("isPublic must be a boolean", 400);
  }

  const trimmed = name.trim();
  const wantPublic = isPublic ?? true;
  const result = await createCategory(trimmed, color, wantPublic);
  if (!result.ok) return jsonError("that category already exists", 409);

  revalidatePath("/");
  return NextResponse.json(
    { ok: true, id: result.id, name: trimmed, color, isPublic: wantPublic },
    { status: 201 },
  );
}
