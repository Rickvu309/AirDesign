import type { ElementId } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { exportPackage } from "@airdesign/pptx"
import type { MeasuredFit, MeasuredRows } from "@airdesign/render"
import { deckParts } from "@/device-copy"
import { chosenParts } from "@/export/chosen-parts"
import { exportFileName } from "@/export/export-file-name"
import { bakeFills } from "@/export/fill-bake"
import { bakeFits } from "@/export/fit-bake"
import { bakeMasks } from "@/export/mask-bake"
import { bakeRows } from "@/export/rows-bake"
import { maskPicture } from "@/export/mask-picture"
import { bakeShadows } from "@/export/shadow-bake"
import { exportablePictures, PicturesUploading, withIcons, type PictureStore } from "@/picture-tool"

export type ExportRequest = {
  readonly slides?: readonly number[]
  readonly signal?: AbortSignal
}

export type ExportStop = "file" | "edits" | "write"

export class ExportStopped extends Error {
  readonly stop: ExportStop

  constructor(stop: ExportStop, options?: ErrorOptions) {
    super(stop, options)
    this.name = "ExportStopped"
    this.stop = stop
  }
}

const asked = new Map<string, readonly number[] | undefined>()

export type Painted = {
  readonly fits: ReadonlyMap<ElementId, MeasuredFit>
  readonly rows: ReadonlyMap<ElementId, MeasuredRows>
}

async function written(file: Uint8Array, edited: () => Promise<ReadonlyMap<string, Uint8Array>>): Promise<Uint8Array> {
  try {
    return await exportPackage(file, await edited())
  } catch (error) {
    throw error instanceof PicturesUploading ? error : new ExportStopped("write", { cause: error })
  }
}

export async function exportDeck(
  id: string,
  ready: Promise<void>,
  pictures: PictureStore,
  request?: ExportRequest,
  painted: Painted = { fits: new Map(), rows: new Map() },
): Promise<{ readonly leftOut: number }> {
  const slides = request === undefined ? asked.get(id) : request.slides
  asked.set(id, slides)
  await ready
  const stored = await deckParts(id)
  if (stored === null || typeof stored === "string") throw new ExportStopped("file")
  const opened = await connect(memoryRemote()).openDeck(id)
  if (!opened.ok) throw new ExportStopped("edits")
  await exportablePictures(pictures, id, opened.register)
  let leftOut = 0
  const bytes = await written(stored.file, async () => {
    const icons = await withIcons(pictures, id, opened.register, (held) => {
      const chosen = chosenParts(stored.parts, opened.register, slides, held)
      leftOut = chosen.leftOut.length
      return chosen.parts
    })
    const chosen = bakeRows(bakeFits(icons, opened.register, painted.fits), opened.register, painted.rows)
    const masked = await bakeMasks(chosen, maskPicture())
    return bakeShadows(await bakeFills(masked, opened.register))
  })
  if (request?.signal?.aborted === true) return { leftOut }
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const url = URL.createObjectURL(new Blob([copy]))
  const link = document.createElement("a")
  link.href = url
  link.download = exportFileName(stored.name)
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return { leftOut }
}
