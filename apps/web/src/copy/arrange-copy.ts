import type { StackMove } from "@airdesign/document"

export const arrangeCopy = {
  label: {
    front: "Bring to front",
    forward: "Bring forward",
    backward: "Send backward",
    back: "Send to back",
  },
  said: {
    front: "Brought to front",
    forward: "Brought forward",
    backward: "Sent backward",
    back: "Sent to back",
  },
  shortcut: {
    front: "Ctrl+Shift+]",
    forward: "Ctrl+]",
    backward: "Ctrl+[",
    back: "Ctrl+Shift+[",
  },
} as const satisfies {
  readonly label: Record<StackMove, string>
  readonly said: Record<StackMove, string>
  readonly shortcut: Record<StackMove, string>
}

export const arrangeMoves = ["front", "forward", "backward", "back"] as const satisfies readonly StackMove[]

export const groupCopy = {
  label: { group: "Group", ungroup: "Ungroup", frame: "Add auto layout" },
  said: { group: "Grouped", ungroup: "Ungrouped", frame: "Added auto layout" },
  shortcut: { group: "Ctrl+G", ungroup: "Ctrl+Shift+G", frame: "Shift+A" },
} as const
