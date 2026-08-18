"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { CheckCheck, MoreHorizontal, Palette, Plus, Trash2, X } from "lucide-react";
import type { TodoCategory, TodoTask } from "@/lib/todos";
import { pickNextUnusedColor } from "@/lib/colors";
import { MAX_CATEGORY_NAME_LEN, MAX_TASK_TITLE_LEN } from "@/lib/validate";
import { cn } from "@/lib/utils";
import { Button } from "@/components/chrome/button";
import { Checkbox } from "@/components/chrome/checkbox";
import { ColorSwatchPicker } from "@/components/chrome/color-swatch";
import { useDialog } from "@/components/chrome/dialog";
import { EmptyState } from "@/components/chrome/empty-state";
import { InlineEdit } from "@/components/chrome/inline-edit";
import { Input } from "@/components/chrome/input";
import { Menu } from "@/components/chrome/menu";
import { useToast } from "@/components/chrome/toast";
import {
  clearDoneTasksAction,
  createCategoryAction,
  createTaskAction,
  deleteCategoryAction,
  deleteTaskAction,
  recolorCategoryAction,
  renameCategoryAction,
  renameTaskAction,
  setTaskDoneAction,
  type ActionResult,
} from "@/app/actions";

type BoardProps = {
  categories: TodoCategory[];
  tasks: TodoTask[];
};

/**
 * The board is server-fed and action-driven: every mutation is a server action
 * that revalidates "/" and streams fresh props back down, so this component
 * holds no copy of the data — only drafts and open/closed flags. The one
 * exception is the done checkbox, which gets an optimistic layer because a
 * ~100ms round trip between click and checkmark reads as a broken checkbox.
 */
export function TasksBoard({ categories, tasks }: BoardProps) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [optimisticTasks, applyDone] = useOptimistic(
    tasks,
    (state, patch: { id: string; done: boolean }) =>
      state.map((t) => (t.id === patch.id ? { ...t, done: patch.done } : t)),
  );

  const tasksByCategory = useMemo(() => {
    const map = new Map<string, TodoTask[]>();
    for (const task of optimisticTasks) {
      const list = map.get(task.categoryId);
      if (list) list.push(task);
      else map.set(task.categoryId, [task]);
    }
    return map;
  }, [optimisticTasks]);

  const surface = (result: ActionResult) => {
    if (!result.ok) toast({ title: result.error, variant: "danger" });
  };

  const toggleTask = (task: TodoTask) => {
    startTransition(async () => {
      applyDone({ id: task.id, done: !task.done });
      surface(await setTaskDoneAction(task.id, !task.done));
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {categories.length === 0 ? (
        <EmptyState
          title="no categories yet"
          description="add one below — tasks live under categories."
        />
      ) : (
        categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            tasks={tasksByCategory.get(category.id) ?? []}
            onToggleTask={toggleTask}
          />
        ))
      )}
      <AddCategoryForm usedColors={categories.map((c) => c.color)} />
    </div>
  );
}

function CategorySection({
  category,
  tasks,
  onToggleTask,
}: {
  category: TodoCategory;
  tasks: TodoTask[];
  onToggleTask: (task: TodoTask) => void;
}) {
  const { toast } = useToast();
  const { confirm } = useDialog();
  const [, startTransition] = useTransition();
  const [recoloring, setRecoloring] = useState(false);
  const [draft, setDraft] = useState("");

  const doneCount = tasks.filter((t) => t.done).length;

  const surface = (result: ActionResult) => {
    if (!result.ok) toast({ title: result.error, variant: "danger" });
  };

  // InlineEdit's contract is throw-to-rollback, while the actions return
  // expected failures as values (Next masks thrown messages in production) —
  // so convert here: a returned error becomes a local throw and the draft
  // snaps back to the committed name.
  const commitRename = async (next: string) => {
    const result = await renameCategoryAction(category.id, next);
    if (!result.ok) {
      toast({ title: result.error, variant: "danger" });
      throw new Error(result.error);
    }
  };

  const removeCategory = async () => {
    const ok = await confirm({
      title: `delete "${category.name}"?`,
      message:
        tasks.length > 0
          ? `its ${tasks.length} ${tasks.length === 1 ? "task goes" : "tasks go"} with it.`
          : undefined,
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      surface(await deleteCategoryAction(category.id));
    });
  };

  const addTask = (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    startTransition(async () => {
      const result = await createTaskAction(category.id, title);
      if (!result.ok) {
        toast({ title: result.error, variant: "danger" });
        // Give the typed text back instead of eating it.
        setDraft(title);
      }
    });
  };

  return (
    <section
      aria-label={category.name}
      className="border border-l-2 border-white/10"
      style={{ borderLeftColor: category.color }}
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <InlineEdit
            value={category.name}
            onCommit={commitRename}
            aria-label={`rename ${category.name}`}
            maxLength={MAX_CATEGORY_NAME_LEN}
            className="text-sm font-medium"
          />
        </div>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          {doneCount}/{tasks.length} done
        </span>
        <Menu
          align="right"
          trigger={<MoreHorizontal size={14} aria-hidden />}
          items={[
            {
              label: "change color",
              icon: Palette,
              onSelect: () => setRecoloring((v) => !v),
            },
            {
              label: "clear completed",
              icon: CheckCheck,
              disabled: doneCount === 0,
              onSelect: () =>
                startTransition(async () => {
                  surface(await clearDoneTasksAction(category.id));
                }),
            },
            { label: "delete category", icon: Trash2, onSelect: removeCategory },
          ]}
        />
      </header>

      {recoloring && (
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
          <ColorSwatchPicker
            value={category.color}
            onChange={(hex) =>
              startTransition(async () => {
                surface(await recolorCategoryAction(category.id, hex));
              })
            }
            ariaLabel={`color for ${category.name}`}
          />
          <Button variant="ghost" size="sm" onClick={() => setRecoloring(false)}>
            done
          </Button>
        </div>
      )}

      {tasks.length > 0 && (
        <ul>
          {tasks.map((task) => (
            <li
              key={task.id}
              className="group flex items-center gap-3 border-b border-white/5 px-4 py-1.5 last:border-b-0"
            >
              <Checkbox
                checked={task.done}
                onChange={() => onToggleTask(task)}
                aria-label={task.done ? `mark "${task.title}" open` : `mark "${task.title}" done`}
              />
              <div className="min-w-0 flex-1">
                <InlineEdit
                  value={task.title}
                  onCommit={async (next) => {
                    const result = await renameTaskAction(task.id, next);
                    if (!result.ok) {
                      toast({ title: result.error, variant: "danger" });
                      throw new Error(result.error);
                    }
                  }}
                  aria-label={`edit "${task.title}"`}
                  maxLength={MAX_TASK_TITLE_LEN}
                  className={cn("text-sm", task.done && "text-white/35 line-through")}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                label={`delete "${task.title}"`}
                tooltip="delete"
                className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                onClick={() =>
                  startTransition(async () => {
                    surface(await deleteTaskAction(task.id));
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addTask} className="flex items-center gap-2 px-4 py-1.5">
        <Plus size={14} className="shrink-0 text-white/30" aria-hidden />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add a task"
          aria-label={`add a task to ${category.name}`}
          maxLength={MAX_TASK_TITLE_LEN}
          className="border-0 px-0 py-1.5"
        />
      </form>
    </section>
  );
}

function AddCategoryForm({ usedColors }: { usedColors: string[] }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  // null means "follow the suggestion" — after a category is added the board's
  // colors change and the suggestion recomputes, so the picker keeps pointing
  // at the least-used hex without any state reset.
  const [picked, setPicked] = useState<string | null>(null);
  const suggested = useMemo(() => pickNextUnusedColor(usedColors), [usedColors]);
  const color = picked ?? suggested;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await createCategoryAction(trimmed, color);
      if (!result.ok) {
        toast({ title: result.error, variant: "danger" });
        return;
      }
      setName("");
      setPicked(null);
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border border-dashed border-white/20 p-4"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
        new category
      </span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="category name"
          aria-label="new category name"
          maxLength={MAX_CATEGORY_NAME_LEN}
          className="w-56"
        />
        <ColorSwatchPicker value={color} onChange={setPicked} ariaLabel="new category color" />
        <Button type="submit" variant="solid" size="sm" disabled={!name.trim() || pending}>
          add
        </Button>
      </div>
    </form>
  );
}
