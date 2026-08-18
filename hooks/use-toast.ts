"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "default" | "success" | "danger";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type ToastOptions = {
  title: ReactNode;
  description?: ReactNode;
  /** Tone. `danger` is the only variant that reaches for color (red). */
  variant?: ToastVariant;
  /**
   * Milliseconds before auto-dismiss. `0` or `Infinity` pins the toast until
   * it is dismissed by hand — use it for anything carrying an `action` the
   * user must actually be able to reach.
   */
  duration?: number;
  /** Trailing slot under the copy, e.g. an undo button. */
  action?: ReactNode;
};

/** A queued toast: the caller's options with the defaults resolved. */
export type ToastRecord = ToastOptions & {
  id: string;
  variant: ToastVariant;
  duration: number;
};

export type ToastContextValue = {
  /** Queue a toast. Returns its id so callers can dismiss it early. */
  toast: (options: ToastOptions) => string;
  /** Dismiss one toast by id, or every toast when called with no argument. */
  dismiss: (id?: string) => void;
};

/**
 * Exported so the styled `ToastProvider` can own the provider element while
 * the state machine lives here. Consumers should reach for `useToast`.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export type UseToastStoreOptions = {
  /** Default auto-dismiss delay in ms for toasts that don't set one. */
  duration?: number;
  /** How many toasts stay on screen; the oldest fall off past this. */
  max?: number;
};

export type UseToastStoreReturn = ToastContextValue & {
  toasts: ToastRecord[];
  /** Freeze every countdown — wire to the viewport's pointer/focus enter. */
  pause: () => void;
  /** Resume every frozen countdown from where it stopped. */
  resume: () => void;
};

/**
 * A countdown owned outside React state: the remaining time only matters when
 * a timer is torn down and rebuilt (hover pause), and re-rendering every toast
 * once a second to show nothing new would be wasteful.
 */
type Countdown = {
  /** null while paused. */
  handle: number | null;
  /** Milliseconds still owed when the current run started. */
  remaining: number;
  /** Wall clock at which the current run started, for computing the rest. */
  startedAt: number;
};

/**
 * Headless toast queue: add, auto-expire, dismiss, and pause/resume the whole
 * stack. No markup and no styling — pair it with your own viewport, or use the
 * `ToastProvider` that ships alongside it.
 *
 * Pausing is stack-wide rather than per-toast on purpose: a cursor resting on
 * the stack means the user is reading it, and letting the neighbours keep
 * expiring underneath would shuffle the thing being read out from the pointer.
 */
export function useToastStore({
  duration = 4000,
  max = 4,
}: UseToastStoreOptions = {}): UseToastStoreReturn {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, Countdown>());
  // Monotonic counter rather than Date.now()/random, so ids never depend on
  // when the module happened to render.
  const seq = useRef(0);
  const paused = useRef(false);

  const stopCountdown = useCallback((id: string) => {
    const countdown = timers.current.get(id);
    if (countdown?.handle != null) window.clearTimeout(countdown.handle);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id?: string) => {
      if (id === undefined) {
        for (const key of [...timers.current.keys()]) stopCountdown(key);
        setToasts([]);
        return;
      }
      stopCountdown(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [stopCountdown],
  );

  const startCountdown = useCallback(
    (id: string, ms: number) => {
      // Non-finite or non-positive means "stay until dismissed".
      if (!Number.isFinite(ms) || ms <= 0) return;
      const handle = window.setTimeout(() => dismiss(id), ms);
      timers.current.set(id, { handle, remaining: ms, startedAt: Date.now() });
    },
    [dismiss],
  );

  const toast = useCallback(
    (options: ToastOptions) => {
      seq.current += 1;
      const id = `toast-${seq.current}`;
      const record: ToastRecord = {
        ...options,
        id,
        variant: options.variant ?? "default",
        duration: options.duration ?? duration,
      };
      setToasts((prev) => {
        const next = [...prev, record];
        // Overflow is trimmed here but its timers are deliberately left to
        // fire: dismissing an id that is already gone is a no-op, and it keeps
        // this updater pure (it runs twice under StrictMode).
        return next.length > max ? next.slice(next.length - max) : next;
      });
      if (paused.current) {
        // Queued while the pointer is parked on the stack — bank the full
        // duration so `resume` starts it fresh instead of dropping it.
        timers.current.set(id, {
          handle: null,
          remaining: record.duration,
          startedAt: Date.now(),
        });
      } else {
        startCountdown(id, record.duration);
      }
      return id;
    },
    [duration, max, startCountdown],
  );

  const pause = useCallback(() => {
    if (paused.current) return;
    paused.current = true;
    const at = Date.now();
    for (const [id, countdown] of timers.current) {
      if (countdown.handle == null) continue;
      window.clearTimeout(countdown.handle);
      timers.current.set(id, {
        handle: null,
        remaining: Math.max(0, countdown.remaining - (at - countdown.startedAt)),
        startedAt: at,
      });
    }
  }, []);

  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    for (const [id, countdown] of [...timers.current]) {
      if (countdown.handle != null) continue;
      startCountdown(id, countdown.remaining);
    }
  }, [startCountdown]);

  // Never leave a timeout pointing at an unmounted tree.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const countdown of map.values()) {
        if (countdown.handle != null) window.clearTimeout(countdown.handle);
      }
      map.clear();
    };
  }, []);

  return { toasts, toast, dismiss, pause, resume };
}
