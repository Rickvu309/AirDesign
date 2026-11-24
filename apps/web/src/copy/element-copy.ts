export type RemovalRefusal = "animated" | "group"

export type CopyRefusal = "kind" | "group-box" | "present"

export type ElsewhereRefusal = "layout" | "carried"

export const elementCopy = {
  removeRefusedTitle: "Unable to delete this layer",
  removeRefusedBody: {
    animated: "AirDesign can't remove this layer because it has an animation.",
    group: "It is inside a group, and AirDesign can't delete one layer of a group yet.",
  },
  copyRefusedTitle: "Unable to duplicate this layer",
  clipRefusedTitle: "Unable to copy this layer",
  pasteRefusedTitle: "Unable to paste this layer",
  pasteElsewhereBody: {
    layout: "It takes its look from its slide layout, so AirDesign can't move it to another deck yet.",
    carried: "It holds an image or a frame AirDesign can't move to another deck yet.",
  },
  copyRefusedBody: {
    kind: "It is a layer kept as the file has it, or a group that holds one, and AirDesign can't duplicate those yet.",
    "group-box": "It is inside a frame, and AirDesign can't duplicate layers in a frame yet.",
    present: "It shows the slide number, and each slide has one.",
  },
} as const satisfies {
  readonly removeRefusedTitle: string
  readonly removeRefusedBody: Readonly<Record<RemovalRefusal, string>>
  readonly copyRefusedTitle: string
  readonly clipRefusedTitle: string
  readonly pasteRefusedTitle: string
  readonly pasteElsewhereBody: Readonly<Record<ElsewhereRefusal, string>>
  readonly copyRefusedBody: Readonly<Record<CopyRefusal, string>>
}
