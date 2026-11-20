import type { Command } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"

export async function storeCommand(deckId: string, command: Command): Promise<boolean> {
  const link = connect(memoryRemote())
  if (command.command === "slide") return (await link.enqueueSlide(deckId, command.file, command.edit)).ok
  if (command.command !== "person" || command.node === undefined || command.v === undefined) return false
  return (await link.enqueueRow(deckId, { v: command.v, patch: command.patch }, command.node, "")).ok
}
