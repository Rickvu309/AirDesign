export const effectsCopy = { section: "Effects", shadow: "Shadow", glow: "Glow", softEdge: "Soft edge" } as const

export const effectsWords: Readonly<Record<string, string>> = {
  "shadow.subtle": "Smaller",
  "shadow.medium": "Middle",
  "shadow.strong": "Larger",
  outer: "Outer",
  halo: "Glow",
  radius: "Radius",
  blur: "Blur",
  distance: "Distance",
  direction: "Direction",
}
