import Link from "next/link";
import { Lock } from "lucide-react";
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
async function listStampedNotes(includePrivate: boolean) {
  const notes = await listNotes(includePrivate);
  const now = Date.now();
  return notes.map((note) => ({
    ...note,
    stamp: formatRelativeTime(now, note.updatedAt),
  }));
}

export default async function NotesPage() {
  // Public read, owner write: visitors get the public notes (filtered in
  // SQL), the signed-in owner gets everything plus the editing surface.
  const admin = await isAdminServer();
  const notes = await listStampedNotes(admin);

  return (
    <div className="min-h-dvh">
      <SiteHeader admin={admin} />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
            notes
          </h1>
          {admin && (
            <form action={createNoteAction}>
              <Button type="submit" variant="solid" size="sm">
                new note
              </Button>
            </form>
          )}
        </div>
        <div className="mt-6">
          {notes.length === 0 ? (
            // Empty-because-new (owner) vs empty-because-nothing-is-public
            // (visitor) — different copy for different causes.
            admin ? (
              <EmptyState
                title="no notes yet"
                description="a note is a named page of markdown — like a doc, without the ceremony."
              />
            ) : (
              <EmptyState
                title="nothing here yet"
                description="public notes show up here once there are some."
              />
            )
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
                    <span className="flex shrink-0 items-baseline gap-3">
                      {admin && !note.isPublic && (
                        <span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
                          <Lock size={11} aria-hidden />
                          private
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-white/40">
                        {note.stamp}
                      </span>
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
