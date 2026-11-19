export const picturePanelCopy = {
  mode: "Fill mode",
  section: "Image",
  source: "Icon",
  recolor: "Recolor",
  overlay: "Overlay",
  blur: "Blur",
  overlayOpacity: "Overlay opacity",
  crop: "Crop",
  cropHandles: {
    topLeft: "Crop top left",
    top: "Crop top",
    topRight: "Crop top right",
    right: "Crop right",
    bottomRight: "Crop bottom right",
    bottom: "Crop bottom",
    bottomLeft: "Crop bottom left",
    left: "Crop left",
  },
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
