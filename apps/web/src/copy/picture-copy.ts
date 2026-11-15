import { limits } from "@airdesign/document"

const largest = `${String(limits.media / 1_000_000)} MB`

export const pictureCopy = {
  add: "Add picture",
  "picture-type": "Unable to add picture. Choose a PNG, JPEG or GIF file.",
  "picture-size": `Unable to add picture. Choose one smaller than ${largest}.`,
  "picture-unread": "Unable to add picture. Its file can't be read, so choose another PNG, JPEG or GIF file.",
  uploading: "Picture is still uploading from another device",
  exportWaiting: "Unable to export. A picture is uploading.",
  section: "Picture",
  source: "Icon",
  recolor: "Recolor",
  crop: "Crop",
  addIcon: "Add icon",
  search: "Search icons",
  searchHint: "Type a word, such as rocket",
  noIcons: "No icon matches. Try another word.",
  current: (name: string) => `Shows the ${name} icon`,
  raster: "Shows a picture file. Pick an icon to replace it.",
} as const

export const pictureWords: Readonly<Record<string, string>> = {
  grayscale: "Grayscale",
  duotone: "Duotone",
  dark: "Dark",
  light: "Light",
}
