import { notFound, redirect } from "next/navigation";
import { isAdminServer } from "@/lib/auth-server";
import { getNote } from "@/lib/notes";
import { isRecordId } from "@/lib/validate";
import { NoteEditor } from "@/components/note-editor";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export const metadata = { title: "note" };

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminServer())) redirect("/login");

  const { id } = await params;
  if (!isRecordId(id)) notFound();
  const note = await getNote(id);
  if (!note) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-6">
        <NoteEditor note={note} />
      </main>
    </div>
  );
}
