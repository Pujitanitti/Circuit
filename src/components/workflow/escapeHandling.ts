export type ModalState = { showShortcuts: boolean; showPreflight: boolean };
export type EscapeAction = "close-shortcuts" | "close-preflight" | "clear-selection";

/**
 * Escape must close whichever modal is on top before it touches anything
 * underneath — a modal open over the canvas should never let Escape leak
 * through and silently clear the canvas selection behind it. Pure so the
 * priority order itself has a direct regression test (see
 * escapeHandling.test.ts) independent of how Canvas.tsx wires it up.
 */
export function resolveEscapeAction(state: ModalState): EscapeAction {
  if (state.showShortcuts) return "close-shortcuts";
  if (state.showPreflight) return "close-preflight";
  return "clear-selection";
}
