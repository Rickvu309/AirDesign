import * as doom from "@airdesign/doom"

import { colorWords, paintWords } from "./agent-read.js"
import type { DeckHost } from "./deck-host.js"
import { type Laid, layoutOf } from "./problems-answer.js"

export type ReadNode = {
  readonly id: doom.NodeId
  readonly kind: string
  readonly role?: string
  readonly parent: doom.NodeId | undefined
  readonly box?: {
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
    readonly rotation: number
  }
  readonly text?: string
  readonly textStyle?: string
  readonly fill?: string
  readonly color?: string
  readonly children: readonly doom.NodeId[]
}

function readNode(view: doom.Doom, node: doom.Node, boxes: Laid["boxes"]): ReadNode {
  const role = doom.propOf(node, "role")
  const box = boxes?.get(node.id) ?? doom.propOf(node, "box")
  const text = doom.propOf(node, "text")
  const fill = paintWords(doom.propOf(node, "fills") ?? [])
  const color = text === undefined ? undefined : doom.uniformColor(text)
  return {
    id: node.id,
    kind: doom.layerKind(node),
    ...(role === undefined ? {} : { role }),
    parent: doom.parentOf(node)?.id,
    ...(box === undefined ? {} : { box: { x: box.x, y: box.y, w: box.w, h: box.h, rotation: box.rotation } }),
    ...(text === undefined ? {} : { text: doom.textToMarkdown(text), textStyle: text.style }),
    ...(fill === "" ? {} : { fill }),
    ...(color === undefined ? {} : { color: colorWords(color) }),
    children: doom.childrenOf(view, node.id).map((child) => child.id),
  }
}

export function readNodes(view: doom.Doom, node: doom.Node, boxes: Laid["boxes"]): readonly ReadNode[] {
  const below = doom.descendantsOf(view, node.id)
  return (node.type === "slide" ? below : [node, ...below]).map((each) => readNode(view, each, boxes))
}

const laidViews = new WeakMap<object, { readonly view: doom.Doom; readonly laid: Map<string, Promise<Laid>> }>()

export function laidOnce(run: object, host: DeckHost, view: doom.Doom, slides: readonly doom.NodeId[]): Promise<Laid> {
  const held = laidViews.get(run)
  const cache = held?.view === view ? held.laid : new Map<string, Promise<Laid>>()
  if (held?.view !== view) laidViews.set(run, { view, laid: cache })
  const key = slides.join(" ")
  const laid = cache.get(key) ?? layoutOf(host, view, () => slides)
  cache.set(key, laid)
  return laid
}
