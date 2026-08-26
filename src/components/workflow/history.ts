/**
 * Generic bounded undo/redo stack. Kept pure and framework-free so it's
 * unit-testable without mounting React Flow — Canvas.tsx just calls
 * `push` on every graph-changing action and `undo`/`redo` on the
 * corresponding keyboard shortcuts.
 */
export type History<T> = { past: T[]; present: T; future: T[] };

const MAX_HISTORY = 50;

export function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] };
}

export function push<T>(history: History<T>, next: T): History<T> {
  return { past: [...history.past, history.present].slice(-MAX_HISTORY), present: next, future: [] };
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1] as T;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const next = history.future[0] as T;
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}

export const canUndo = <T,>(h: History<T>) => h.past.length > 0;
export const canRedo = <T,>(h: History<T>) => h.future.length > 0;
