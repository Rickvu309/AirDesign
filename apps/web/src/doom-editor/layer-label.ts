import type * as doom from "@airdesign/doom"
import { airaCopy, airaKeptLayerName } from "@/copy/aira-copy"
import { propOf } from "@/editing/node-props"
import { kindOf } from "./design-model"

const wordsShown = 40

export function layerLabel(view: doom.Doom, id: doom.NodeId): string {
  const node = view.nodes.get(id)
  const name = propOf(node, "name")
  if (typeof name === "string" && name.trim() !== "") return airaKeptLayerName(name.trim())
  const words = propOf(node, "text")?.chars.split("\n")[0]?.trim() ?? ""
  if (words !== "")
    return airaKeptLayerName(words.length <= wordsShown ? words : `${words.slice(0, wordsShown).trimEnd()}…`)
  return airaCopy.keptKinds[kindOf(view, id) as keyof typeof airaCopy.keptKinds] ?? airaCopy.keptKinds.shape
}
