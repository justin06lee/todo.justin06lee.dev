import { isAdminServer } from "@/lib/auth-server";
import { listBoard } from "@/lib/todos";
import { SiteHeader } from "@/components/site-header";
import { TasksBoard } from "@/components/tasks-board";

// Live data, no cache — the point of the page is the current state of the
// list.
export const dynamic = "force-dynamic";

export const metadata = { title: "tasks" };

export default async function TasksPage() {
  // Public read, owner write: anonymous visitors get the public categories
  // (the filter runs in SQL — private rows never leave the database for
  // them), the signed-in owner gets everything plus the editing surface.
  const admin = await isAdminServer();
  const { categories, tasks } = await listBoard(admin);

  return (
    <div className="min-h-dvh">
      <SiteHeader admin={admin} />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          tasks
        </h1>
        <div className="mt-6">
          <TasksBoard categories={categories} tasks={tasks} admin={admin} />
        </div>
      </main>
    </div>
  );
}
