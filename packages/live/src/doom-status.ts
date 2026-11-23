import type * as doom from "@airdesign/doom"

export type DeckStatus =
  | { readonly kind: "saved" }
  | { readonly kind: "saving" }
  | { readonly kind: "offline" }
  | { readonly kind: "blocked" }
  | { readonly kind: "storage-failed" }
  | { readonly kind: "set-aside"; readonly edits: number; readonly tooLarge: boolean }

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
    readonly aside: readonly { readonly refused: doom.Refusal["refused"] }[]
  },
  last: DeckStatus,
): DeckStatus {
  if (shown.aside.length > 0) {
    const edits = shown.aside.length
    const tooLarge = shown.aside.some((notice) => notice.refused === "limit")
    return last.kind === "set-aside" && last.edits === edits && last.tooLarge === tooLarge
      ? last
      : { kind: "set-aside", edits, tooLarge }
  }
  if (shown.unsent === 0) return plain.saved
  if (!shown.kept) return plain.storageFailed
  return shown.reach === "reached" ? plain.saving : plain[shown.reach]
}
