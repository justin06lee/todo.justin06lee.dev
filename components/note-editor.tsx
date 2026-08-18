"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Note } from "@/lib/notes";
import { MAX_NOTE_TITLE_LEN } from "@/lib/validate";
import { Button } from "@/components/chrome/button";
import { useDialog } from "@/components/chrome/dialog";
import { Editor } from "@/components/chrome/editor";
import { InlineEdit } from "@/components/chrome/inline-edit";
import { Prose } from "@/components/chrome/prose";
import { Switch } from "@/components/chrome/switch";
import { useToast } from "@/components/chrome/toast";
import {
  deleteNoteAction,
  renameNoteAction,
  saveNoteAction,
  setNotePublicAction,
} from "@/app/actions";

// Module scope so the reference is stable — the editor memoizes its preview
// pane on it, and a fresh closure per render would reflow the preview on every
// keystroke.
function renderMarkdown(
  source: string,
  { highlightLine }: { highlightLine: number | null },
) {
  return (
    <Prose lineSync highlightLine={highlightLine} linkComponent={Link} imageTheme="dark">
      {source}
    </Prose>
  );
}

/**
 * Title commits on blur/Enter through InlineEdit; the body is explicit-save
 * (button or cmd/ctrl+s) like the desk, not autosave — markdown mid-keystroke
 * is usually broken markdown, and a save that fires on every pause turns the
 * shared database into a keylogger.
 */
export function NoteEditor({ note }: { note: Note }) {
  const { toast } = useToast();
  const { confirm } = useDialog();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState(note.content);
  const [savedContent, setSavedContent] = useState(note.content);
  const dirty = content !== savedContent;
  // Local so the switch moves instantly; reverted if the action fails. A
  // switch (not a checkbox) because the flip takes effect the moment it
  // moves — there is no submit to commit it.
  const [isPublic, setIsPublic] = useState(note.isPublic);

  const toggleVisibility = (next: boolean) => {
    setIsPublic(next);
    startTransition(async () => {
      const result = await setNotePublicAction(note.id, next);
      if (!result.ok) {
        setIsPublic(!next);
        toast({ title: result.error, variant: "danger" });
      }
    });
  };

  const save = () => {
    // Read through state directly: this closure is re-created each render, and
    // the keydown listener below goes through a ref to reach the latest one.
    if (content === savedContent) return;
    const value = content;
    startTransition(async () => {
      const result = await saveNoteAction(note.id, value);
      if (!result.ok) {
        toast({ title: result.error, variant: "danger" });
        return;
      }
      setSavedContent(value);
    });
  };

  // The listener binds once on window and reads the latest save through a ref,
  // so cmd/ctrl+s works even when focus is outside the textarea (same shape as
  // desk's handler). The ref is written in an effect, not during render — the
  // commit always runs before any keydown can fire.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // A hard navigation with unsaved edits deserves the browser's "leave site?"
  // prompt. Soft (client) navigations don't fire this — acceptable: the two
  // in-app exits are the back button and delete, and delete confirms.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const commitTitle = async (next: string) => {
    const result = await renameNoteAction(note.id, next);
    if (!result.ok) {
      toast({ title: result.error, variant: "danger" });
      throw new Error(result.error);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `delete "${note.title}"?`,
      message: "this can't be undone.",
      danger: true,
    });
    if (!ok) return;
    // The action redirects to /notes on success.
    await deleteNoteAction(note.id);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          label="back to notes"
          tooltip="notes"
          href="/notes"
          linkComponent={Link}
        />
        <div className="min-w-0 flex-1">
          <InlineEdit
            value={note.title}
            onCommit={commitTitle}
            aria-label="note title"
            maxLength={MAX_NOTE_TITLE_LEN}
            className="text-lg font-medium"
          />
        </div>
        <Switch
          checked={isPublic}
          onChange={toggleVisibility}
          size="sm"
          label={isPublic ? "public" : "private"}
          ariaLabel="note visibility"
        />
        <span
          role="status"
          className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40"
        >
          {pending ? "saving" : dirty ? "unsaved" : "saved"}
        </span>
        <Button variant="solid" size="sm" onClick={save} disabled={!dirty || pending}>
          save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          label="delete note"
          tooltip="delete"
          onClick={remove}
        />
      </div>
      <div className="mt-4 flex-1">
        <Editor
          value={content}
          onChange={setContent}
          size="screen"
          className="border border-white/10"
          placeholder="write markdown…"
          renderMarkdown={renderMarkdown}
        />
      </div>
    </div>
  );
}
