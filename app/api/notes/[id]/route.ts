import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, readJsonObject, requireAdmin } from "@/lib/api";
import {
  MAX_NOTE_CONTENT_LEN,
  MAX_NOTE_TITLE_LEN,
  isContentWithin,
  isRecordId,
  isTitleWithin,
} from "@/lib/validate";
import {
  deleteNote,
  getNote,
  noteExists,
  setNotePublic,
  updateNote,
} from "@/lib/notes";

export const dynamic = "force-dynamic";

/** The full note, body included. Admin only, like the rest of the API. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isRecordId(id)) return jsonError("unknown note", 400);

  const note = await getNote(id);
  if (!note) return jsonError("note not found", 404);
  return NextResponse.json(note);
}

/**
 * Partial update over the same writers the actions use: `updateNote` writes
 * only the columns named (a body save can't clobber a racing title edit) and
 * `setNotePublic` deliberately doesn't bump updated_at. A vanished note is
 * reported the way the actions report it: "this note was deleted".
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isRecordId(id)) return jsonError("unknown note", 400);

  const body = await readJsonObject(req);
  if (!body) return jsonError("invalid JSON", 400);
  const { title, content, isPublic } = body;

  if (title !== undefined && !isTitleWithin(title, MAX_NOTE_TITLE_LEN)) {
    return jsonError("enter a title", 400);
  }
  if (content !== undefined && !isContentWithin(content, MAX_NOTE_CONTENT_LEN)) {
    return jsonError("this note is too long to save", 400);
  }
  if (isPublic !== undefined && typeof isPublic !== "boolean") {
    return jsonError("isPublic must be a boolean", 400);
  }

  const patch: { title?: string; content?: string } = {};
  if (title !== undefined) patch.title = title.trim();
  if (content !== undefined) patch.content = content;

  let changed = false;
  if (patch.title !== undefined || patch.content !== undefined) {
    if (!(await updateNote(id, patch))) return jsonError("this note was deleted", 404);
    changed = true;
  }
  if (isPublic !== undefined) {
    if (!(await setNotePublic(id, isPublic))) {
      return jsonError("this note was deleted", 404);
    }
    changed = true;
  }
  if (!changed && !(await noteExists(id))) {
    // An empty patch writes nothing, but the response should still be
    // truthful about whether the note exists.
    return jsonError("this note was deleted", 404);
  }

  if (changed) {
    revalidatePath("/notes");
    revalidatePath(`/notes/${id}`);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isRecordId(id)) return jsonError("unknown note", 400);
  if (!(await noteExists(id))) return jsonError("note not found", 404);

  await deleteNote(id);
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  return NextResponse.json({ ok: true });
}
