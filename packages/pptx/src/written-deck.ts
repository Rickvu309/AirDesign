import { shapeOf, slideBirths, type ElementId, type Register, type SlideCommand } from "@airdesign/document"
import { orderedParts, type MediaBytes } from "./slide-order-route.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type WrittenDeck = {
  readonly parts: Parts
  readonly register: Register
  readonly leftOut: readonly SlideCommand[]
}

const knownLeftOut = new WeakMap<Parts, Set<string>>()

function built(parts: Parts, register: Register, media: MediaBytes | undefined): Parts | null {
  try {
    return orderedParts(parts, register, media)
  } catch {
    return null
  }
}

function madeNodes(command: SlideCommand): readonly ElementId[] {
  if (command.slide === "element-add")
    return [command.element.node, ...(command.pasted?.layers ?? []).map((layer) => layer.element.node)]
  if (command.slide === "element-clone")
    return [command.element.node, ...(command.layers ?? []).map((layer) => layer.element.node)]
  if (command.slide === "element-group")
    return command.backdrop === undefined ? [command.element.node] : [command.element.node, command.backdrop.node]
  return []
}

function madeBy(commands: readonly SlideCommand[]): (node: ElementId) => boolean {
  const nodes = new Set(commands.flatMap(madeNodes))
  const slides = new Set<string>(commands.flatMap((command) => slideBirths(command).map((birth) => birth.id)))
  return (node) => nodes.has(node) || (node.includes(".") && slides.has(shapeOf(node).slide))
}

function firstUnwritable(parts: Parts, register: Register, media: MediaBytes | undefined): number {
  let writes = 0
  let fails = register.order.length
  while (fails - writes > 1) {
    const middle = Math.floor((writes + fails) / 2)
    if (built(parts, { ...register, order: register.order.slice(0, middle) }, media) === null) fails = middle
    else writes = middle
  }
  return fails - 1
}

export function writtenDeck(parts: Parts, register: Register, media?: MediaBytes): WrittenDeck {
  const whole = built(parts, register, media)
  if (whole !== null) return { parts: whole, register, leftOut: [] }
  const known = knownLeftOut.get(parts) ?? new Set<string>()
  knownLeftOut.set(parts, known)
  const leftOut = register.order.filter((command) => known.has(JSON.stringify(command)))
  let trying: Register = { ...register, order: register.order.filter((command) => !leftOut.includes(command)) }
  for (;;) {
    const written = built(parts, trying, media)
    if (written !== null) {
      const made = madeBy(leftOut)
      const nodes = trying.nodes.filter((node) => !made(node))
      return { parts: written, register: { ...trying, nodes }, leftOut }
    }
    const at = firstUnwritable(parts, trying, media)
    const command = trying.order[at]
    if (command === undefined) throw new Error("order")
    known.add(JSON.stringify(command))
    leftOut.push(command)
    trying = { ...trying, order: trying.order.filter((_, index) => index !== at) }
  }
}
