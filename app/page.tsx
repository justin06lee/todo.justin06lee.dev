import { redirect } from "next/navigation";
import { isAdminServer } from "@/lib/auth-server";
import { listBoard } from "@/lib/todos";
import { SiteHeader } from "@/components/site-header";
import { TasksBoard } from "@/components/tasks-board";

// Live data, no cache — the point of the page is the current state of the
// list, and it's admin-only anyway.
export const dynamic = "force-dynamic";

export const metadata = { title: "tasks" };

export default async function TasksPage() {
  // The layout draws no boundary — every page under the password re-checks.
  if (!(await isAdminServer())) redirect("/login");

  const { categories, tasks } = await listBoard();

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          tasks
        </h1>
        <div className="mt-6">
          <TasksBoard categories={categories} tasks={tasks} />
        </div>
      </main>
    </div>
  );
}
