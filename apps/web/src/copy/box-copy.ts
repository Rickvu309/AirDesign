export const boxCopy = {
  section: "Position and size",
  x: "X",
  y: "Y",
  w: "Width",
  h: "Height",
  rot: "Rotation",
  flipH: "Flip horizontally",
  flipV: "Flip vertically",
  align: "Align",
  distribute: "Distribute",
} as const

export const boxWords: Readonly<Record<string, string>> = {
  top: "Top",
  middle: "Middle",
  bottom: "Bottom",
  horizontal: "Horizontally",
  vertical: "Vertically",
}
