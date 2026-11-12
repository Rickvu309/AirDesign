import { limits } from "@airdesign/document"

const largest = `${String(limits.media / 1_000_000)} MB`

export const pictureCopy = {
  add: "Add picture",
  "picture-type": "Unable to add picture. Choose a PNG, JPEG or GIF file.",
  "picture-size": `Unable to add picture. Choose one smaller than ${largest}.`,
  "picture-unread": "Unable to add picture. Its file can't be read, so choose another PNG, JPEG or GIF file.",
  uploading: "Picture is still uploading from another device",
  exportWaiting: "Unable to export. A picture is uploading.",
} as const
