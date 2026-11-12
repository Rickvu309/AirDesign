import { connect, getParts, memoryRemote } from "@airdesign/live"
import { exportPackage } from "@airdesign/pptx"
import { chosenParts } from "@/export/chosen-parts"
import { exportFileName } from "@/export/export-file-name"
import { ensureMarkup } from "@/markup"
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
): Promise<string | null> {
  const slides = request === undefined ? asked.get(id) : request.slides
  asked.set(id, slides)
  await ready
  await ensureMarkup()
  const stored = await getParts(id)
  if (!stored.ok) throw new Error("parts")
  const opened = await connect(memoryRemote()).openDeck(id)
  if (!opened.ok) throw new Error("register")
  const held = await exportablePictures(pictures, id, opened.register)
  const bytes = await exportPackage(stored.file, chosenParts(stored.parts, opened.register, slides, held))
  if (request?.signal?.aborted === true) return null
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const url = URL.createObjectURL(new Blob([copy]))
  const link = document.createElement("a")
  const name = exportFileName(stored.name)
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return name
}
