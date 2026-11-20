import { connect, getParts, memoryRemote } from "@airdesign/live"
import { exportPackage } from "@airdesign/pptx"
import { chosenParts } from "@/export/chosen-parts"
import { exportFileName } from "@/export/export-file-name"
import { bakeFills } from "@/export/fill-bake"
import { bakeMasks } from "@/export/mask-bake"
import { maskPicture } from "@/export/mask-picture"
import { bakeShadows } from "@/export/shadow-bake"
import { exportablePictures, type PictureStore } from "@/picture-tool"

export type ExportRequest = {
  readonly slides?: readonly number[]
  readonly signal?: AbortSignal
}

const asked = new Map<string, readonly number[] | undefined>()

export async function exportDeck(
  id: string,
  ready: Promise<void>,
  pictures: PictureStore,
  request?: ExportRequest,
): Promise<void> {
  const slides = request === undefined ? asked.get(id) : request.slides
  asked.set(id, slides)
  await ready
  const stored = await getParts(id)
  if (!stored.ok) throw new Error("parts")
  const opened = await connect(memoryRemote()).openDeck(id)
  if (!opened.ok) throw new Error("register")
  const held = await exportablePictures(pictures, id, opened.register)
  const chosen = chosenParts(stored.parts, opened.register, slides, held)
  const masked = await bakeMasks(chosen, maskPicture())
  const baked = await bakeFills(masked, opened.register)
  const bytes = await exportPackage(stored.file, await bakeShadows(baked))
  if (request?.signal?.aborted === true) return
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
}
