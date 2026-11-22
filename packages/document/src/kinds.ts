export const kinds = [
  "deck",
  "master",
  "layout",
  "section",
  "slide",
  "notes",
  "shape",
  "connector",
  "group",
  "chart",
  "kept",
] as const

export type Kind = (typeof kinds)[number]
