import type { TransitionValue } from "@airdesign/document"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8 } from "./package-bytes.js"
import { pushSide, sideOf, speedDuration, type Side } from "./transition-map.js"

export type Arrival = { readonly state: "value"; readonly value: TransitionValue } | { readonly state: "kept" }

type Advance = { readonly click: true } | { readonly delay: number }

const clicked: Advance = { click: true }
const offered = new Set(["p:fade", "p:push", "p:cover", "p:pull"])
const allowed = new Set(["spd", "advClick", "advTm", "p14:dur"])
const noneClick: TransitionValue = { none: { advance: clicked } }

function attr(element: MarkupElement, name: string): string | undefined {
  return element.attributes.find((attribute) => attribute.name === name)?.value
}

function declared(name: string): boolean {
  return name === "xmlns" || name.startsWith("xmlns:")
}

function chain(elements: readonly MarkupElement[], element: MarkupElement): MarkupElement[] {
  const found: MarkupElement[] = []
  let parent = element.parent
  while (parent >= 0) {
    const node = elements[parent]
    if (node === undefined) break
    found.push(node)
    parent = node.parent
  }
  return found
}

export function transitionBlocks(elements: readonly MarkupElement[]): MarkupElement[] {
  const blocks: MarkupElement[] = []
  for (const transition of elements) {
    if (transition.kind !== "p:transition") continue
    const above = chain(elements, transition)
    if (!above.some((element) => element.kind === "p:sld")) continue
    if (above.some((element) => element.kind === "p:timing")) continue
    const alternate = [...above].reverse().find((element) => element.kind === "mc:AlternateContent")
    const block = alternate ?? transition
    if (elements[block.parent]?.kind !== "p:sld") continue
    if (!blocks.some((held) => held.index === block.index)) blocks.push(block)
  }
  return blocks
}

function children(elements: readonly MarkupElement[], parent: MarkupElement): MarkupElement[] {
  return elements.filter((element) => element.parent === parent.index)
}

function whole(text: string | undefined): number | null {
  if (text === undefined || !/^[0-9]+$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) ? value : null
}

function readAdvance(transition: MarkupElement): Advance | null {
  const click = attr(transition, "advClick")
  const time = attr(transition, "advTm")
  const on = click === undefined || click === "1" || click === "true"
  const off = click === "0" || click === "false"
  if (!on && !off) return null
  if (on && time !== undefined) return null
  if (off && time === undefined) return null
  if (on) return clicked
  const delay = whole(time)
  if (delay === null || delay > 86_400_000) return null
  return { delay }
}

function readDuration(transition: MarkupElement): number | null {
  const exact = attr(transition, "p14:dur")
  if (exact !== undefined) {
    const duration = whole(exact)
    return duration !== null && duration >= 10 && duration <= 10_000 ? duration : null
  }
  return speedDuration(attr(transition, "spd"))
}

function directionOf(effect: MarkupElement, map: Readonly<Record<string, Side>>): Side | null {
  const names = effect.attributes.filter((attribute) => !declared(attribute.name))
  if (names.some((attribute) => attribute.name !== "dir")) return null
  const dir = attr(effect, "dir") ?? "l"
  return map[dir] ?? null
}

function readEffect(elements: readonly MarkupElement[], transition: MarkupElement): Arrival {
  const names = transition.attributes.map((attribute) => attribute.name).filter((name) => !declared(name))
  if (names.some((name) => !allowed.has(name))) return { state: "kept" }
  const kids = children(elements, transition)
  if (kids.length > 1 || kids.some((kid) => kid.kind === "p:sndAc")) return { state: "kept" }
  const advance = readAdvance(transition)
  if (advance === null) return { state: "kept" }
  const effect = kids[0]
  if (effect === undefined) {
    if ("click" in advance) return { state: "kept" }
    if (attr(transition, "spd") !== undefined || attr(transition, "p14:dur") !== undefined) return { state: "kept" }
    return { state: "value", value: { none: { advance } } }
  }
  if (!offered.has(effect.kind)) return { state: "kept" }
  const duration = readDuration(transition)
  if (duration === null) return { state: "kept" }
  if (effect.kind === "p:fade") {
    const extra = effect.attributes.filter((attribute) => !declared(attribute.name))
    if (extra.some((attribute) => attribute.name !== "thruBlk")) return { state: "kept" }
    const thru = attr(effect, "thruBlk")
    if (thru !== undefined && thru !== "0" && thru !== "false") return { state: "kept" }
    return { state: "value", value: { dissolve: { duration, advance } } }
  }
  const direction = directionOf(effect, effect.kind === "p:push" ? pushSide : sideOf)
  if (direction === null) return { state: "kept" }
  if (effect.kind === "p:push") return { state: "value", value: { push: { direction, duration, advance } } }
  if (effect.kind === "p:cover") return { state: "value", value: { moveIn: { direction, duration, advance } } }
  return { state: "value", value: { moveOut: { direction, duration, advance } } }
}

function morphOf(elements: readonly MarkupElement[], block: MarkupElement) {
  const choices = children(elements, block).filter((kid) => kid.kind === "mc:Choice")
  const choice = choices.length === 1 ? choices[0] : undefined
  if (choice === undefined || attr(choice, "Requires") !== "p159") return null
  const kids = children(elements, choice)
  const transition = kids.length === 1 ? kids[0] : undefined
  if (transition?.kind !== "p:transition") return null
  const effects = children(elements, transition)
  const morph = effects.length === 1 ? effects[0] : undefined
  return morph?.kind === "p159:morph" ? { transition, morph } : null
}

function readMorph(elements: readonly MarkupElement[], block: MarkupElement): Arrival {
  const found = morphOf(elements, block)
  if (found === null) return { state: "kept" }
  const { transition, morph } = found
  const names = transition.attributes.map((attribute) => attribute.name).filter((name) => !declared(name))
  if (names.some((name) => !allowed.has(name))) return { state: "kept" }
  const options = morph.attributes.filter((attribute) => !declared(attribute.name))
  if (options.some((attribute) => attribute.name !== "option")) return { state: "kept" }
  const option = attr(morph, "option")
  if (option !== undefined && option !== "byObject") return { state: "kept" }
  const advance = readAdvance(transition)
  const duration = readDuration(transition)
  if (advance === null || duration === null) return { state: "kept" }
  return { state: "value", value: { smartAnimate: { duration, advance } } }
}

export function readArrival(bytes: Uint8Array | undefined): Arrival {
  if (bytes === undefined) return { state: "value", value: noneClick }
  const document = markupDocument(bytes)
  if (!document.wellFormed) {
    return decodeUtf8(bytes).includes("<p:transition") ? { state: "kept" } : { state: "value", value: noneClick }
  }
  const blocks = transitionBlocks(document.elements)
  const block = blocks[0]
  if (block === undefined) return { state: "value", value: noneClick }
  if (blocks.length > 1) return { state: "kept" }
  if (block.kind === "mc:AlternateContent") return readMorph(document.elements, block)
  return readEffect(document.elements, block)
}
