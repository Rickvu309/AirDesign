import { emfSvg } from "./metafile-emf.js"
import { wmfSvg } from "./metafile-wmf.js"
import { tiffFile } from "./tiff-read.js"

export type DrawablePicture =
  | { readonly contentType: "image/svg+xml"; readonly data: string }
  | { readonly contentType: "image/bmp"; readonly data: Uint8Array }

export function drawablePicture(bytes: Uint8Array): DrawablePicture | null {
  const tiff = tiffFile(bytes)
  if (tiff !== null) return { contentType: "image/bmp", data: tiff }
  const svg = emfSvg(bytes) ?? wmfSvg(bytes)
  return svg === null ? null : { contentType: "image/svg+xml", data: svg }
}
