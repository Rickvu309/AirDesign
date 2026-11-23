import { picturePanelCopy } from "./picture-panel-copy"
import { limits } from "@airdesign/doom"

const largest = `${String(limits.media / 1_000_000)} MB`
const most = `${String(limits.pixels / 1_000_000)} megapixels`

export const pictureCopy = {
  add: "Add image",
  replace: "Replace image",
  "picture-type": "Unable to add image. Choose a PNG, JPEG or GIF file.",
  "picture-size": `Unable to add image. Choose one under ${largest} and ${most}.`,
  "picture-unread": "Unable to add image. Its file can't be read, so choose another PNG, JPEG or GIF file.",
  uploading: "Image is still uploading from another device",
  exportWaiting: "Unable to export. An image is uploading.",
  ...picturePanelCopy,
  addIcon: "Add icon",
  search: "Search icons",
  searchHint: "Type a word, such as rocket",
  noIcons: "No icon matches. Try another word.",
  current: (name: string) => `Shows the ${name} icon`,
  raster: "Shows an image file. Pick an icon to replace it.",
} as const

export { pictureWords } from "./picture-panel-copy"
