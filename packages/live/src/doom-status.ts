import type * as doom from "@airdesign/doom"

type SaveState =
  | { readonly kind: "saved" }
  | { readonly kind: "saving" }
  | { readonly kind: "offline" }
  | { readonly kind: "blocked" }
  | { readonly kind: "storage-failed" }
  | { readonly kind: "set-aside"; readonly edits: number; readonly tooLarge: boolean }

export type DeckStatus =
  | SaveState
  | { readonly kind: "turn-refused"; readonly turn: "undo" | "redo"; readonly save: SaveState }
  | { readonly kind: "turn-skipped"; readonly turn: "undo" | "redo"; readonly save: SaveState }

export type Reach = "reached" | "offline" | "blocked"

const plain = {
  saved: { kind: "saved" },
  saving: { kind: "saving" },
  offline: { kind: "offline" },
  blocked: { kind: "blocked" },
  storageFailed: { kind: "storage-failed" },
} as const satisfies Record<string, DeckStatus>

export function statusOf(
  shown: {
    readonly unsent: number
    readonly reach: Reach
    readonly kept: boolean
    readonly aside: readonly { readonly refused: doom.Refusal["refused"]; readonly turn?: "undo" | "redo" }[]
  },
  last: DeckStatus,
): DeckStatus {
  const turned = shown.aside.findLast((notice) => notice.turn !== undefined)
  const save = saveState(shown, "save" in last ? last.save : last)
  if (turned?.turn === undefined) return save
  const { turn } = turned
  const kind = turned.refused === "missing" ? "turn-skipped" : "turn-refused"
  return last.kind === kind && last.turn === turn && last.save === save ? last : { kind, turn, save }
}

function saveState(shown: Parameters<typeof statusOf>[0], last: SaveState): SaveState {
  const aside = shown.aside.filter((notice) => notice.turn === undefined)
  if (aside.length > 0) {
    const edits = aside.length
    const tooLarge = aside.some((notice) => notice.refused === "limit")
    return last.kind === "set-aside" && last.edits === edits && last.tooLarge === tooLarge
      ? last
      : { kind: "set-aside", edits, tooLarge }
  }
  if (shown.unsent === 0) return plain.saved
  if (!shown.kept) return plain.storageFailed
  return shown.reach === "reached" ? plain.saving : plain[shown.reach]
}
