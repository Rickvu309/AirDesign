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
    front: "]",
    forward: "Ctrl+]",
    backward: "Ctrl+[",
    back: "[",
  },
} as const satisfies {
  readonly label: Record<StackMove, string>
  readonly said: Record<StackMove, string>
  readonly shortcut: Record<StackMove, string>
}

export const arrangeMoves = ["front", "forward", "backward", "back"] as const satisfies readonly StackMove[]

export const groupCopy = {
  label: { group: "Group", ungroup: "Ungroup", "plain-frame": "Frame selection", frame: "Add auto layout" },
  said: { group: "Grouped", ungroup: "Ungrouped", "plain-frame": "Framed", frame: "Added auto layout" },
  shortcut: { group: "Ctrl+G", ungroup: "Ctrl+Shift+G", "plain-frame": "Ctrl+Alt+G", frame: "Shift+A" },
} as const
