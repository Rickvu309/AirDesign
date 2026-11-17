export const effectsCopy = { section: "Effects", shadow: "Shadow", glow: "Glow", softEdge: "Soft edge" } as const

export const effectsWords: Readonly<Record<string, string>> = {
  "shadow.subtle": "Subtle",
  "shadow.medium": "Medium",
  "shadow.strong": "Strong",
  outer: "Outer",
  halo: "Glow",
  radius: "Radius",
  blur: "Blur",
  distance: "Distance",
  direction: "Direction",
}
