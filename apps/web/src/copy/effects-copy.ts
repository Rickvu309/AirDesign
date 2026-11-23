export const effectsCopy = {
  section: "Effects",
  shadow: "Shadow",
  innerShadow: "Inner shadow",
  glow: "Glow",
  softEdge: "Soft edge",
  blur: "Blur",
  add: "Add",
  reflection: "Reflection",
  fillOverlay: "Fill overlay",
  presetShadow: "Preset shadow",
  graph: "Effect graph",
  placeholder:
    "A title or a body takes one drop shadow. A second would put it in a group, and a placeholder cannot sit in a group.",
} as const

export const effectsWords: Readonly<Record<string, string>> = {
  "shadow.soft": "Soft",
  "shadow.lifted": "Lifted",
  "shadow.glow": "Glow",
  outer: "Outer",
  inner: "Inner",
  halo: "Glow",
  radius: "Radius",
  blur: "Blur",
  distance: "Distance",
  direction: "Direction",
  "add.blur": "Blur",
  "add.glow": "Glow",
  "add.innerShadow": "Inner shadow",
  "add.shadow": "Shadow",
  "add.softEdge": "Soft edge",
  remove: "Remove",
}
