import { filePixels, rgbaFile } from "./bitmap-file.js"
import type { Blit } from "./metafile-play.js"
import type { Box } from "./metafile-state.js"

const either = 0xee0086
const both = 0x8800c6
const copy = 0xcc0020

export const pairedOperations: ReadonlySet<number> = new Set([either, both])

function sameBox(left: Box, right: Box): boolean {
  return (
    left.left === right.left && left.top === right.top && left.right === right.right && left.bottom === right.bottom
  )
}

export function pairedBlit(first: Blit, second: Blit): Blit | null {
  if (first.bitmap === null || second.bitmap === null || first.operation === second.operation) return null
  if (!pairedOperations.has(first.operation) || !pairedOperations.has(second.operation)) return null
  if (!sameBox(first.dest, second.dest) || !sameBox(first.source, second.source)) return null
  const [lit, mask] = first.operation === either ? [first, second] : [second, first]
  const shown = lit.bitmap === null ? null : filePixels(lit.bitmap.file)
  const kept = mask.bitmap === null ? null : filePixels(mask.bitmap.file)
  if (shown === null || kept === null || shown.width !== kept.width || shown.height !== kept.height) return null
  const rgba = new Uint8Array(shown.rgba.length)
  for (let at = 0; at < rgba.length; at += 4) {
    const dark = shown.rgba[at] === 0 && shown.rgba[at + 1] === 0 && shown.rgba[at + 2] === 0
    const clear = kept.rgba[at] === 255 && kept.rgba[at + 1] === 255 && kept.rgba[at + 2] === 255
    if (dark && clear) continue
    for (let channel = at; channel < at + 3; channel += 1)
      rgba[channel] =
        lit === first ? (shown.rgba[channel] ?? 0) & (kept.rgba[channel] ?? 0) : (shown.rgba[channel] ?? 0)
    rgba[at + 3] = 255
  }
  const size = { width: shown.width, height: shown.height }
  return { ...second, operation: copy, bitmap: { file: rgbaFile(size, rgba), ...size, bottomUp: false } }
}
