import * as doom from "@airdesign/doom"
import { outlineOf, roundedRectPath } from "./node-outline.js"

type Resolved = doom.Resolved

export type Silhouette = { readonly d: string; readonly matrix: doom.Matrix }

export function silhouetteIn(node: Resolved, parent: doom.Matrix): Silhouette {
  const { w, h } = node.box
  return { d: outlineOf(node).fill ?? roundedRectPath(w, h, node.radius), matrix: doom.artMatrix(parent, node.box) }
}

export function masksOf(nodes: readonly Resolved[]): readonly (Resolved | null)[] {
  let mask: Resolved | null = null
  return nodes.map((node) => {
    if (!node.mask) return mask
    mask = node
    return null
  })
}
