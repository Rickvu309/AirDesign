import { type Media } from "./asset-ref.js"
import type { IndexElement } from "./deck-index.js"
import { type ElementId } from "./element-id.js"

export type PastedLayer = { readonly shape: string; readonly element: IndexElement }

export type PastedLayers = {
  readonly markup: string
  readonly shape: string
  readonly media: readonly Media[]
  readonly layers: readonly PastedLayer[]
}

export function pastedNodes(pasted: PastedLayers | undefined): readonly ElementId[] {
  return (pasted?.layers ?? []).map((layer) => layer.element.node)
}
