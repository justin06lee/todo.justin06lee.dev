import * as React from "react";
import { cn } from "@/lib/utils";

export type EmptyStateSize = "sm" | "md" | "lg";

export type EmptyStateProps = {
  /** One lowercase line saying what isn't here. */
  title: React.ReactNode;
  /** Why it's empty, or what to do about it. */
  description?: React.ReactNode;
  /** Decorative mark above the title — a lucide icon, ascii, anything. */
  icon?: React.ReactNode;
  /** Primary action, usually a Button. */
  action?: React.ReactNode;
  /** Quieter escape hatch beside the action. */
  secondaryAction?: React.ReactNode;
  size?: EmptyStateSize;
  /** Draw the dashed container. Off when the parent already has a border. */
  bordered?: boolean;
  className?: string;
};

const SIZE: Record<EmptyStateSize, { pad: string; title: string; gap: string }> = {
  sm: { pad: "px-6 py-8", title: "text-sm", gap: "gap-2" },
  md: { pad: "px-8 py-14", title: "text-base", gap: "gap-3" },
  lg: { pad: "px-8 py-24", title: "text-lg", gap: "gap-4" },
};

/**
 * The "nothing here" panel — no results, no bookings yet, everything filtered
 * out. Every list in the library was hand-rolling this, and the hand-rolled
 * ones kept forgetting that empty-because-new and empty-because-filtered want
 * different copy and different actions.
 *
 * Dashed by default, which is the library's existing signal for a slot that
 * could hold something but doesn't (see the `dashed` button variant).
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  size = "md",
  bordered = true,
  className,
}: EmptyStateProps) {
  const dimensions = SIZE[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        dimensions.pad,
        dimensions.gap,
        bordered && "border border-dashed border-white/15",
        className,
      )}
    >
      {icon ? (
        <div aria-hidden className="text-white/25">
          {icon}
        </div>
      ) : null}

      <p className={cn("text-white", dimensions.title)}>{title}</p>

      {description ? (
        <p className="max-w-sm text-[13px] leading-relaxed text-white/45">{description}</p>
      ) : null}

      {action || secondaryAction ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
