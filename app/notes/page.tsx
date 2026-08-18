import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminServer } from "@/lib/auth-server";
import { listNotes } from "@/lib/notes";
import { formatRelativeTime } from "@/lib/format-time";
import { createNoteAction } from "@/app/actions";
import { Button } from "@/components/chrome/button";
import { EmptyState } from "@/components/chrome/empty-state";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export const metadata = { title: "notes" };

// Stamping happens at data-prep time, not in the JSX — the page is
// force-dynamic, so "now" is the render's request time.
async function listStampedNotes() {
  const notes = await listNotes();
  const now = Date.now();
  return notes.map((note) => ({
    ...note,
    stamp: formatRelativeTime(now, note.updatedAt),
  }));
}

export default async function NotesPage() {
  if (!(await isAdminServer())) redirect("/login");

  const notes = await listStampedNotes();

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
            notes
          </h1>
          <form action={createNoteAction}>
            <Button type="submit" variant="solid" size="sm">
              new note
            </Button>
          </form>
        </div>
        <div className="mt-6">
          {notes.length === 0 ? (
            <EmptyState
              title="no notes yet"
              description="a note is a named page of markdown — like a doc, without the ceremony."
            />
          ) : (
            <ul className="border border-white/10">
              {notes.map((note) => (
                <li key={note.id} className="border-b border-white/5 last:border-b-0">
                  <Link
                    href={`/notes/${note.id}`}
                    className="flex items-baseline justify-between gap-4 px-4 py-3 transition-colors hover:bg-white/5"
                  >
                    <span className="min-w-0 truncate text-[15px] text-white/80">
                      {note.title}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-white/40">
                      {note.stamp}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
