import { picturePanelCopy } from "./picture-panel-copy"
import { limits } from "@airdesign/doom"

const largest = `${String(limits.media / 1_000_000)} MB`
const most = `${String(limits.pixels / 1_000_000)} megapixels`

export const pictureCopy = {
  replace: "Replace image",
  "picture-type": "Choose a PNG, JPEG or GIF image.",
  "picture-size": `Choose an image under ${largest} and ${most}.`,
  "picture-unread": "Unable to read that image. Choose another.",
  uploading: "Image is still uploading from another device",
  ...picturePanelCopy,
} as const

export { pictureWords } from "./picture-panel-copy"
