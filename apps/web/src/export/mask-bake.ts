import { bakedMask, maskRuns, readSlides, type MaskRun } from "@airdesign/pptx"

type Parts = ReadonlyMap<string, Uint8Array>

export type MaskPicture = (parts: Parts, part: string, run: MaskRun) => Promise<Uint8Array>

export async function bakeMasks(parts: Parts, picture: MaskPicture): Promise<Parts> {
  let next = parts
  for (const { part } of readSlides(parts)) {
    const bytes = parts.get(part)
    const runs = bytes === undefined ? [] : maskRuns(bytes)
    const pictures = new Map<string, Uint8Array>()
    for (const run of runs) if (run.look === "picture") pictures.set(run.mask, await picture(parts, part, run))
    for (const run of runs) next = bakedMask(next, part, run.mask, pictures.get(run.mask) ?? null)
  }
  return next
}
