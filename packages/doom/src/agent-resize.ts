import type { Text } from "./text.js"

type Sized = { readonly w?: number | undefined; readonly h?: number | undefined }

export function resizedBy(text: Text | undefined, box: Sized | undefined, was: Sized | undefined): Text | undefined {
  if (text === undefined || box === undefined) return undefined
  const resize =
    box.h !== undefined && box.h !== was?.h && (text.resize === "height" || text.resize === "widthAndHeight")
      ? "fixed"
      : box.w !== undefined && box.w !== was?.w && text.resize === "widthAndHeight"
        ? "height"
        : text.resize
  return resize === text.resize ? undefined : { ...text, resize }
}
