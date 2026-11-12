import { connect, getParts, memoryRemote } from "@airdesign/live"
import { exportPackage } from "@airdesign/pptx"
import { exportedParts } from "@/exported-parts"
import { exportFileName } from "@/export/export-file-name"
import { ensureMarkup } from "@/markup"

export async function exportDeck(id: string, ready: Promise<void>): Promise<string> {
  await ready
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
  const name = exportFileName(stored.name)
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return name
}
