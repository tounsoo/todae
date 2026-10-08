import type { ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'critical';

/** What `toaster.add()` takes. Add fields of your own through `createToaster<YourFields>()`. */
export type ToastOptions = {
  /** Reuse an id to replace a toast that is still showing instead of adding another. */
  id?: string;
  tone?: ToastTone;
  title?: ReactNode;
  description?: ReactNode;
  /** Milliseconds before it dismisses itself. `Infinity` keeps it until dismissed. */
  duration?: number;
};

export type ToastRecord<T extends object = object> = Readonly<
  Omit<ToastOptions, 'id' | 'tone' | 'duration'> &
    T & {
      id: string;
      tone: ToastTone;
      duration: number;
      /** False once dismissed, while its exit motion runs. */
      open: boolean;
      /** Goes up each time `add()` shows this id, so its timer starts again. */
      version: number;
    }
>;

export type Toaster<T extends object = object> = {
  /** Shows a toast and returns its id. */
  add: (toast: ToastOptions & T) => string;
  /** Changes a toast that has not left yet. */
  update: (id: string, patch: Partial<ToastOptions & T>) => void;
  /** Starts a toast's exit motion, or every toast's without an id. */
  dismiss: (id?: string) => void;
  /** Takes a toast out at once, without the exit motion. Toast.Region calls it when the motion ends. */
  remove: (id: string) => void;
  subscribe: (listener: () => void) => () => void;
  /** Every toast that has not left, oldest first. */
  getSnapshot: () => readonly ToastRecord<T>[];
};

export type CreateToasterOptions = {
  /** Default `duration` in milliseconds. */
  duration?: number;
};

export const DEFAULT_TOAST_DURATION = 5000;

/**
 * A store of toasts that works outside React, so a fetch handler or a store
 * action can call `add()`. Make one per app, at module scope, and pass it to
 * `Toast.Region`.
 */
export function createToaster<T extends object = object>(options: CreateToasterOptions = {}): Toaster<T> {
  const defaultDuration = options.duration ?? DEFAULT_TOAST_DURATION;
  let toasts: readonly ToastRecord<T>[] = [];
  const listeners = new Set<() => void>();
  let nextId = 0;
  let nextVersion = 0;

  function set(next: readonly ToastRecord<T>[]) {
    toasts = next;
    for (const listener of [...listeners]) listener();
  }

  function make(id: string, toast: Partial<ToastOptions & T>, base?: ToastRecord<T>): ToastRecord<T> {
    const record = { ...base, ...toast } as Record<string, unknown>;
    return {
      ...record,
      id,
      tone: (record.tone as ToastTone | undefined) ?? 'info',
      duration: (record.duration as number | undefined) ?? defaultDuration,
      open: true,
      version: base?.version ?? ++nextVersion,
    } as ToastRecord<T>;
  }

  return {
    add(toast) {
      let id = toast.id;
      // A generated id never takes over a toast that is showing under an id of your own.
      while (id === undefined || (toast.id === undefined && toasts.some((item) => item.id === id))) {
        id = `todae-toast-${++nextId}`;
      }
      const index = toasts.findIndex((item) => item.id === id);
      if (index === -1) {
        set([...toasts, make(id, toast)]);
      } else {
        // Replaced in place, so it keeps its spot and starts its timer again.
        const next = [...toasts];
        next[index] = make(id, toast);
        set(next);
      }
      return id;
    },
    update(id, patch) {
      const index = toasts.findIndex((item) => item.id === id);
      if (index === -1) return;
      const current = toasts[index]!;
      // A key set to undefined keeps the current value, as if left out.
      const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      const next = [...toasts];
      next[index] = { ...make(id, defined as Partial<ToastOptions & T>, current), open: current.open };
      set(next);
    },
    dismiss(id) {
      if (!toasts.some((item) => item.open && (id === undefined || item.id === id))) return;
      set(toasts.map((item) => (item.open && (id === undefined || item.id === id) ? { ...item, open: false } : item)));
    },
    remove(id) {
      if (!toasts.some((item) => item.id === id)) return;
      set(toasts.filter((item) => item.id !== id));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return toasts;
    },
  };
}
