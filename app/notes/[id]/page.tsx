import { notFound } from "next/navigation";
import { isAdminServer } from "@/lib/auth-server";
import { getNote } from "@/lib/notes";
import { formatRelativeTime } from "@/lib/format-time";
import { isRecordId } from "@/lib/validate";
import { NoteEditor } from "@/components/note-editor";
import { NoteProse } from "@/components/note-prose";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export const metadata = { title: "note" };

// Outside the component so the impure clock read stays out of render proper
// (the page is force-dynamic; "now" is the request time).
function editedStamp(updatedAt: number): string {
  return formatRelativeTime(Date.now(), updatedAt);
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await isAdminServer();

  const { id } = await params;
  if (!isRecordId(id)) notFound();
  const note = await getNote(id);
  if (!note) notFound();
  // A private note is indistinguishable from a missing one for anyone but the
  // owner — 404, not 403, so the url doesn't leak that something exists.
  if (!note.isPublic && !admin) notFound();

  if (!admin) {
    const stamp = editedStamp(note.updatedAt);
    return (
      <div className="min-h-dvh">
        <SiteHeader admin={false} />
        <main className="mx-auto w-full max-w-3xl px-5 py-8">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="min-w-0 text-lg font-medium">{note.title}</h1>
            <span className="shrink-0 font-mono text-[11px] text-white/40">
              edited {stamp}
            </span>
          </div>
          <div className="mt-6">
            {note.content.trim() ? (
              <NoteProse>{note.content}</NoteProse>
            ) : (
              <p className="text-sm text-white/35">this note is empty.</p>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader admin />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-6">
        <NoteEditor note={note} />
      </main>
    </div>
  );
}
