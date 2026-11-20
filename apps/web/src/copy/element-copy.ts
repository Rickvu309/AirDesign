export type RemovalRefusal = "animated" | "group"

export type CopyRefusal = "kind" | "group-box" | "present"

export const elementCopy = {
  removeRefusedTitle: "Unable to delete this layer",
  removeRefusedBody: {
    animated: "It has an animation in the PowerPoint file, and the exported file can't lose it.",
    group: "It is a group or part of a group, and AirDesign can't delete those yet.",
  },
  copyRefusedTitle: "Unable to duplicate this layer",
  copyRefusedBody: {
    kind: "It is a group, chart or table, and AirDesign can't duplicate those yet.",
    "group-box": "It is part of a group, and AirDesign can't duplicate those yet.",
    present: "It shows the slide number, and each slide has one.",
  },
} as const satisfies {
  readonly removeRefusedTitle: string
  readonly removeRefusedBody: Readonly<Record<RemovalRefusal, string>>
  readonly copyRefusedTitle: string
  readonly copyRefusedBody: Readonly<Record<CopyRefusal, string>>
}
