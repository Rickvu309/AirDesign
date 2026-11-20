export type RemovalRefusal = "animated" | "group"

export type CopyRefusal = "kind" | "group-box" | "present"

export const elementCopy = {
  removeRefusedTitle: "Unable to delete this layer",
  removeRefusedBody: {
    animated: "It has an animation in the PowerPoint file, and the exported file can't lose it.",
    group: "It is a group or part of a group, and AirDesign can't delete those yet.",
  },
  copyRefusedTitle: "Unable to duplicate this layer",
  clipRefusedTitle: "Unable to copy this layer",
  pasteRefusedTitle: "Unable to paste this layer",
  pasteElsewhereTitle: "Unable to paste these layers",
  pasteElsewhereBody:
    "They come from another deck, and AirDesign can paste layers only into the deck they were copied from.",
  copyRefusedBody: {
    kind: "It is a chart or table, or a group that holds one, and AirDesign can't duplicate those yet.",
    "group-box": "It is inside a frame, and AirDesign can't duplicate layers in a frame yet.",
    present: "It shows the slide number, and each slide has one.",
  },
} as const satisfies {
  readonly removeRefusedTitle: string
  readonly removeRefusedBody: Readonly<Record<RemovalRefusal, string>>
  readonly copyRefusedTitle: string
  readonly clipRefusedTitle: string
  readonly pasteRefusedTitle: string
  readonly pasteElsewhereTitle: string
  readonly pasteElsewhereBody: string
  readonly copyRefusedBody: Readonly<Record<CopyRefusal, string>>
}
