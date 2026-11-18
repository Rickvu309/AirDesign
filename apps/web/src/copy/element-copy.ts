export type RemovalRefusal = "animated" | "group"

export const elementCopy = {
  removeRefusedTitle: "Unable to delete this layer",
  removeRefusedBody: {
    animated: "It has an animation in the PowerPoint file, and the exported file can't lose it.",
    group: "It is a group or part of a group, and AirDesign can't delete those yet.",
  },
} as const satisfies {
  readonly removeRefusedTitle: string
  readonly removeRefusedBody: Readonly<Record<RemovalRefusal, string>>
}
