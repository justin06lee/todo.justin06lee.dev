import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, readJsonObject, requireAdmin } from "@/lib/api";
import {
  MAX_NOTE_CONTENT_LEN,
  MAX_NOTE_TITLE_LEN,
  isContentWithin,
  isTitleWithin,
} from "@/lib/validate";
import { createNote, listNotes } from "@/lib/notes";

export const dynamic = "force-dynamic";

/**
 * The owner's note list, private included, bodies excluded — `listNotes`
 * never selects `content` (a body can be 200k characters and a list renders
 * none of it); `GET /api/notes/[id]` is the reader of the body.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(await listNotes(true));
}

/**
 * HTTP twin of `createNoteAction`, with the fields the UI never needed:
 * every one optional, defaulting to what the action creates ("untitled",
 * empty body, public).
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

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

  const storedTitle = title === undefined ? "untitled" : title.trim();
  const storedPublic = isPublic ?? true;
  const id = await createNote(storedTitle, content ?? "", storedPublic);

  revalidatePath("/notes");
  return NextResponse.json(
    { ok: true, id, title: storedTitle, isPublic: storedPublic },
    { status: 201 },
  );
}
