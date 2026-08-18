"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SwitchSize = "sm" | "md";

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Text beside the track. Clicking it toggles, like a real label. */
  label?: React.ReactNode;
  /** Second line under the label. */
  description?: React.ReactNode;
  /** Put the track before the label instead of after it. */
  labelPosition?: "start" | "end";
  size?: SwitchSize;
  disabled?: boolean;
  /** Accessible name when there is no visible `label`. */
  ariaLabel?: string;
  className?: string;
};

const SIZE = {
  sm: { track: "h-4 w-7", knob: "size-3", travel: "translate-x-3" },
  md: { track: "h-5 w-9", knob: "size-4", travel: "translate-x-4" },
} as const;

/**
 * Instant on/off toggle.
 *
 * Distinct from `checkbox`, which states an intent that a submit later
 * commits; a switch takes effect the moment it moves, which is why it carries
 * `role="switch"` and reads as "on"/"off" rather than "checked".
 *
 * Square track, square knob — the pill shape every other library uses is the
 * one thing that would make it look imported from somewhere else.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  labelPosition = "end",
  size = "md",
  disabled = false,
  ariaLabel,
  className,
}: SwitchProps) {
  const dimensions = SIZE[size];

  const track = (
    <span
      aria-hidden
      className={cn(
        "relative shrink-0 border transition-colors",
        dimensions.track,
        checked ? "border-white bg-white/20" : "border-white/25 bg-transparent",
        !disabled && "group-hover:border-white/50",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-1/2 -translate-y-1/2 transition-transform duration-150 ease-out",
          "motion-reduce:transition-none",
          dimensions.knob,
          checked ? `${dimensions.travel} bg-white` : "translate-x-0 bg-white/40",
        )}
      />
    </span>
  );

  const text =
    label || description ? (
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        {label ? <span className="text-sm text-white">{label}</span> : null}
        {description ? (
          <span className="text-[13px] leading-relaxed text-white/50">{description}</span>
        ) : null}
      </span>
    ) : null;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex items-center gap-3",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
        disabled && "cursor-not-allowed opacity-40",
        labelPosition === "start" && "flex-row-reverse justify-between",
        className,
      )}
    >
      {track}
      {text}
    </button>
  );
}
