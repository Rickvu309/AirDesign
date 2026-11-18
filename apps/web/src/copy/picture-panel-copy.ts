export const picturePanelCopy = {
  mode: "Fill mode",
  section: "Image",
  source: "Icon",
  recolor: "Recolor",
  overlay: "Overlay",
  blur: "Blur",
  overlayOpacity: "Overlay opacity",
  crop: "Crop",
  heldBack: "This image can't change to another fill yet.",
} as const

export const pictureWords: Readonly<Record<string, string>> = {
  fill: "Fill",
  fit: "Fit",
  crop: "Crop",
  tile: "Tile",
  stretch: "Stretch",
  grayscale: "Grayscale",
  duotone: "Duotone",
  dark: "Dark",
  light: "Light",
}
