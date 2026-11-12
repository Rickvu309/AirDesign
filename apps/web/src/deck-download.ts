import { connect, getParts, memoryRemote } from "@airdesign/live"
import { exportPackage } from "@airdesign/pptx"
import { exportFileName } from "@/export/export-file-name"
import { exportedParts } from "@/exported-parts"
import { ensureMarkup } from "@/markup"

export async function downloadDeck(id: string) {
  await ensureMarkup()
  const stored = await getParts(id)
  if (!stored.ok) throw new Error("parts")
  const opened = await connect(memoryRemote()).openDeck(id)
  if (!opened.ok) throw new Error("register")
  const bytes = await exportPackage(stored.file, exportedParts(stored.parts, opened.register))
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
