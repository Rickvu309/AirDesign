import type * as doom from "@airdesign/doom"

export type Run = "typing" | "deleting"

export type Kept = { readonly draft: doom.Text; readonly anchor: number; readonly focus: number }

export type Changed = { readonly from: number; readonly to: number; readonly run?: Run | undefined }

export type TextHistory = {
  readonly undo: readonly Kept[]
  readonly redo: readonly Kept[]
  readonly run: { readonly kind: Run; readonly at: number } | null
}

export const noHistory: TextHistory = { undo: [], redo: [], run: null }

export function recorded(history: TextHistory, before: Kept, changed: Changed | null, caret: number): TextHistory {
  const run = changed?.run
  const last = history.run
  const continues = run !== undefined && last?.kind === run && (last.at === changed?.from || last.at === changed?.to)
  const kept = changed === null ? before : { ...before, anchor: changed.from, focus: changed.to }
  return {
    undo: continues ? history.undo : [...history.undo, kept],
    redo: [],
    run: run === undefined ? null : { kind: run, at: caret },
  }
}

export function moved(history: TextHistory): TextHistory {
  return history.run === null ? history : { ...history, run: null }
}

export function turned(
  history: TextHistory,
  kind: "undo" | "redo",
  now: Kept,
): { readonly history: TextHistory; readonly back: Kept } | null {
  const back = history[kind].at(-1)
  if (back === undefined) return null
  const rest = history[kind].slice(0, -1)
  return {
    back,
    history:
      kind === "undo"
        ? { undo: rest, redo: [...history.redo, now], run: null }
        : { undo: [...history.undo, now], redo: rest, run: null },
  }
}
