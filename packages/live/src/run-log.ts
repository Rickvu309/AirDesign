import * as doom from "@airdesign/doom"
import type { DeckId } from "@airdesign/catalog"
import type { DoomRemote } from "./doom-remote.js"

export async function runInLog(
  remote: DoomRemote,
  deck: DeckId,
  view: doom.Doom,
  run: string,
): Promise<doom.RunEdit[] | undefined> {
  const answer = await remote.run?.({ deck, run })
  if (answer === undefined || !answer.ok || answer.edits.length === 0) return undefined
  const known = new Map(view.nodes)
  const edits: doom.RunEdit[] = []
  for (const [index, raw] of answer.edits.entries()) {
    const read = doom.readRunEdit(raw, answer.replaced[index], { ...view, nodes: known })
    if (doom.isRefusal(read)) return undefined
    for (const write of read.writes)
      if (write.prop === "type" && !known.has(write.node))
        known.set(write.node, { id: write.node, rev: read.rev, type: write.value } as doom.Node)
    edits.push(read)
  }
  return edits
}
