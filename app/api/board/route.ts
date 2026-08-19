import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { listBoard } from "@/lib/todos";

export const dynamic = "force-dynamic";

/**
 * The whole board in one read, tasks nested under their categories. Admin
 * only: this is the owner's view (private categories included) — the public
 * surface is the site itself, not this API.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { categories, tasks } = await listBoard(true);
  return NextResponse.json({
    categories: categories.map((category) => ({
      ...category,
      tasks: tasks.filter((task) => task.categoryId === category.id),
    })),
  });
}
