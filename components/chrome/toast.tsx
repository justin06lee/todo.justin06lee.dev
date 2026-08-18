"use client";

import * as motion from "motion/react-client";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { Check, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ToastContext,
  useToastStore,
  type ToastPosition,
  type ToastRecord,
  type ToastVariant,
} from "@/hooks/use-toast";

export { useToast } from "@/hooks/use-toast";
export type {
  ToastContextValue,
  ToastOptions,
  ToastPosition,
  ToastRecord,
  ToastVariant,
} from "@/hooks/use-toast";

export type ToastProviderProps = {
  children?: React.ReactNode;
  /** Corner the stack grows from. Defaults to "bottom-right". */
  position?: ToastPosition;
  /** Default auto-dismiss delay in ms. Defaults to 4000. */
  duration?: number;
  /** How many toasts stay on screen at once. Defaults to 4. */
  max?: number;
  /**
   * "viewport" pins the stack to the window (default). "container" pins it to
   * the nearest positioned ancestor instead — for toasts scoped to a panel.
   */
  anchor?: "viewport" | "container";
  /** Accessible name for the live region. Defaults to "notifications". */
  label?: string;
  /** Extra classes for the viewport. */
  className?: string;
};

// Only `danger` spends color; `success` earns its distinction from an icon so
// the stack stays monochrome.
const VARIANT_PANEL: Record<ToastVariant, string> = {
  default: "border-white/20 bg-[#0a0a0a]",
  success: "border-white/25 bg-[#141414]",
  danger: "border-red-400/60 bg-red-400/10",
};

const VARIANT_TITLE: Record<ToastVariant, string> = {
  default: "text-white",
  success: "text-white",
  danger: "text-red-300",
};

const VARIANT_BODY: Record<ToastVariant, string> = {
  default: "text-white/55",
  success: "text-white/55",
  danger: "text-red-300/70",
};

const VARIANT_ICON: Record<ToastVariant, LucideIcon | null> = {
  default: null,
  success: Check,
  danger: TriangleAlert,
};

const VARIANT_CLOSE: Record<ToastVariant, string> = {
  default: "text-white/40 hover:text-white",
  success: "text-white/40 hover:text-white",
  danger: "text-red-300/60 hover:text-red-300",
};

const POSITION: Record<ToastPosition, string> = {
  "top-left": "top-0 left-0 items-start",
  "top-center": "top-0 left-1/2 -translate-x-1/2 items-center",
  "top-right": "top-0 right-0 items-end",
  "bottom-left": "bottom-0 left-0 items-start",
  "bottom-center": "bottom-0 left-1/2 -translate-x-1/2 items-center",
  "bottom-right": "bottom-0 right-0 items-end",
};

/**
 * Stacked, auto-dismissing toast list plus the context that feeds it. Mount
 * one provider near the root and call `useToast().toast(...)` from anywhere.
 *
 * The viewport is always rendered, even while empty: an `aria-live` region has
 * to exist in the DOM *before* its contents change for screen readers to
 * announce them, so mounting it lazily would silence the first toast.
 */
export function ToastProvider({
  children,
  position = "bottom-right",
  duration,
  max,
  anchor = "viewport",
  label = "notifications",
  className,
}: ToastProviderProps) {
  const { toasts, toast, dismiss, pause, resume } = useToastStore({ duration, max });
  const reduceMotion = useReducedMotion();

  const fromTop = position.startsWith("top");
  // Toasts enter from the edge they're anchored to, so the motion reads as
  // sliding in from off-screen rather than drifting in from nowhere.
  const offset = reduceMotion ? 0 : fromTop ? -8 : 8;

  const hidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: offset, scale: 0.98 };
  const shown = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1 };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ol
        aria-live="polite"
        aria-atomic="false"
        aria-label={label}
        // Pause on hover *and* on focus: a keyboard user tabbing to the action
        // needs the toast to stay put just as much as a pointer user does.
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocus={pause}
        onBlur={resume}
        className={cn(
          // The viewport itself never eats clicks — only the toasts do.
          "pointer-events-none z-[90] flex w-full max-w-[22rem] gap-2 p-4",
          anchor === "viewport" ? "fixed" : "absolute",
          POSITION[position],
          // Bottom stacks grow upward, so the newest toast is always the one
          // closest to the corner the eye is already on.
          fromTop ? "flex-col" : "flex-col-reverse",
          className,
        )}
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <ToastItem
              key={item.id}
              toast={item}
              onDismiss={dismiss}
              initial={hidden}
              animate={shown}
              exit={hidden}
              reduceMotion={Boolean(reduceMotion)}
            />
          ))}
        </AnimatePresence>
      </ol>
    </ToastContext.Provider>
  );
}

/** The two motion states the provider hands down, already reduced-motion aware. */
type ToastMotionState = { opacity: number; y?: number; scale?: number };

type ToastItemProps = {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
  initial: ToastMotionState;
  animate: ToastMotionState;
  exit: ToastMotionState;
  reduceMotion: boolean;
};

function ToastItem({
  toast,
  onDismiss,
  initial,
  animate,
  exit,
  reduceMotion,
}: ToastItemProps) {
  const Icon = VARIANT_ICON[toast.variant];

  return (
    <motion.li
      // Layout animation keeps the survivors from snapping into the gap left
      // by a dismissed neighbour — but reduced motion means no sliding at all.
      layout={!reduceMotion}
      initial={initial}
      animate={animate}
      exit={exit}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      className="pointer-events-auto w-full"
    >
      <div
        className={cn(
          "flex w-full items-start gap-3 border p-3",
          VARIANT_PANEL[toast.variant],
        )}
      >
        {Icon && (
          <Icon
            aria-hidden
            className={cn("mt-0.5 size-4 shrink-0", VARIANT_TITLE[toast.variant])}
          />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className={cn("text-sm leading-snug", VARIANT_TITLE[toast.variant])}>
            {toast.title}
          </div>
          {toast.description && (
            <div className={cn("text-xs leading-relaxed", VARIANT_BODY[toast.variant])}>
              {toast.description}
            </div>
          )}
          {toast.action && <div className="pt-1">{toast.action}</div>}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="dismiss"
          className={cn("-mr-1 -mt-1 shrink-0 p-1 transition", VARIANT_CLOSE[toast.variant])}
        >
          <X aria-hidden className="size-3.5" />
        </button>
      </div>
    </motion.li>
  );
}
