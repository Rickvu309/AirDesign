import * as doom from "@airdesign/doom"
import { measureDoom } from "@airdesign/render"
import { toast } from "@/components/ui/toast"
import { designCopy } from "@/copy/design-copy"
import type { EditorClient } from "./use-deck"

function cellsMatch(read: doom.Doom, current: doom.Doom, writes: readonly doom.Write[]): boolean {
  return writes.every(({ node, prop }) => {
    const before = read.nodes.get(node)
    const after = current.nodes.get(node)
    const key = prop.startsWith("theme.") ? "theme" : prop
    return (
      before !== undefined &&
      after !== undefined &&
      doom.onDeck(current.nodes, node) &&
      doom.sameValue(doom.propOf(before, "parent"), doom.propOf(after, "parent")) &&
      doom.sameValue(Reflect.get(before, key), Reflect.get(after, key)) &&
      doom.linkedOwner(read.nodes, node) === doom.linkedOwner(current.nodes, node) &&
      (doom.propOf(before, "instance") === undefined) === (doom.propOf(after, "instance") === undefined)
    )
  })
}

export function commitDesignEdit(client: EditorClient, writes: readonly doom.Write[], read = client.view()): void {
  const proposed = doom.sampleComponentEdit(read, writes)
  if (proposed === null) {
    client.push(writes)
    return
  }
  void commitMeasuredEdit(client, writes, read, proposed)
}

async function commitMeasuredEdit(
  client: EditorClient,
  writes: readonly doom.Write[],
  read: doom.Doom,
  sampled: doom.ComponentEditSample | doom.Refusal,
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = client.view()
    if (current !== read && !cellsMatch(read, current, writes)) break
    const proposed = current === read ? sampled : doom.sampleComponentEdit(current, writes)
    if (proposed === null || doom.isRefusal(proposed)) {
      toast.refusal(designCopy.chartEditFailed)
      return
    }
    let measure
    try {
      measure = await measureDoom(document, proposed.view, proposed.measures)
    } catch {
      toast.refusal(designCopy.chartFontFailed)
      return
    }
    if (client.view() !== current) continue
    const prepared = doom.prepareComponentEdit(current, writes, measure)
    if (doom.isRefusal(prepared) || !client.push(prepared, { read: current }).ok)
      toast.refusal(designCopy.chartEditFailed)
    return
  }
  toast.refusal(designCopy.chartEditStale)
}
