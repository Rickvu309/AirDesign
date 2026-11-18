export const kinds = [
  "deck",
  "theme",
  "master",
  "layout",
  "section",
  "slide",
  "notes",
  "shape",
  "connector",
  "group",
  "table",
  "row",
  "cell",
  "chart",
  "kept",
] as const

export type Kind = (typeof kinds)[number]
