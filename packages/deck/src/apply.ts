import type { ApplyResult, Change, ChangeError, ChangeSet, Deck, Element, Id, Slide } from "./model.ts"
import { isDeck, isElement, isSlide } from "./parse.ts"

class Rejected extends Error {
  readonly code: ChangeError["code"]
  constructor(code: ChangeError["code"], message: string) { super(message); this.code = code }
}
function reject(code: ChangeError["code"], message: string): never { throw new Rejected(code, message) }
export function flatten(elements: readonly Element[]): Element[] {
  return elements.flatMap(e => e.kind === "group" ? [e, ...flatten(e.children)] : [e])
}
export function validate(deck: Deck): void {
  const ids = new Set<Id>([deck.id])
  for (const slide of deck.slides) {
    for (const node of [slide, ...flatten(slide.elements)]) {
      if (ids.has(node.id)) reject("invalid-structure", `Duplicate id ${node.id}`)
      ids.add(node.id)
      if (isElement(node)) {
        if (node.placeholder !== null && !deck.placeholders?.includes(node.placeholder)) reject("invalid-reference", `Missing placeholder ${node.placeholder}`)
        if (node.overlap !== null && !deck.overlaps?.includes(node.overlap)) reject("invalid-reference", `Missing overlap ${node.overlap}`)
      }
      if (node.theme !== null && !deck.themes.some(t => t.id === node.theme)) reject("invalid-reference", `Missing theme ${node.theme}`)
    }
  }
}
function replaceElements(elements: Element[], target: Id, replacement: Element | null): Element[] {
  return elements.flatMap(e => e.id === target ? replacement ? [replacement] : [] : e.kind === "group" && flatten(e.children).some(c => c.id === target) ? [{ ...e, children: replaceElements(e.children, target, replacement) }] : [e])
}
function replace(deck: Deck, target: Id, value: Deck | Slide | Element | null): Deck {
  if (target === deck.id) {
    if (value && isDeck(value) && value.id === target) return value
    return reject("invalid-structure", "Deck root cannot be removed or renamed")
  }
  let found = false
  const slides = deck.slides.flatMap(slide => {
    if (slide.id === target) {
      found = true
      if (value && (!isSlide(value) || value.id !== target)) return reject("invalid-structure", "Slide replacement must retain its id and kind")
      return value && isSlide(value) ? [{ ...value, version: slide.version + 1 }] : []
    }
    const element = flatten(slide.elements).find(e => e.id === target)
    if (!element) return [slide]
    found = true
    if (value && (!isElement(value) || value.id !== target || value.kind !== element.kind)) return reject("invalid-structure", "Element replacement must retain its id and kind")
    return [{ ...slide, version: slide.version + 1, elements: replaceElements(slide.elements, target, value && isElement(value) ? value : null) }]
  })
  if (!found) return reject("invalid-reference", `Missing target ${target}`)
  return { ...deck, slides }
}
function insert(deck: Deck, parent: Id, index: number, value: Slide | Element): Deck {
  function placed<T>(items: T[], item: T): T[] {
    if (index < 0 || index > items.length || !Number.isInteger(index)) return reject("invalid-structure", "Position is outside parent")
    return [...items.slice(0, index), item, ...items.slice(index)]
  }
  if (deck.id === parent) {
    if (!isSlide(value)) return reject("invalid-structure", "Deck children must be slides")
    return { ...deck, slides: placed(deck.slides, value) }
  }
  if (!isElement(value)) return reject("invalid-structure", "Slide and group children must be elements")
  const slide = deck.slides.find(s => s.id === parent)
  if (slide) return replace(deck, parent, { ...slide, elements: placed(slide.elements, value) })
  const group = deck.slides.flatMap(s => flatten(s.elements)).find(e => e.id === parent)
  if (!group) return reject("invalid-reference", `Missing parent ${parent}`)
  if (group.kind !== "group") return reject("invalid-structure", "Parent must be a group")
  return replace(deck, parent, { ...group, children: placed(group.children, value) })
}
function change(deck: Deck, op: Change): Deck {
  switch (op.kind) {
    case "insert": return insert(deck, op.parent, op.index, op.value)
    case "set": return replace(deck, op.target, op.value)
    case "remove": return replace(deck, op.target, null)
    case "move": {
      const node = deck.slides.find(s => s.id === op.target) ?? deck.slides.flatMap(s => flatten(s.elements)).find(e => e.id === op.target)
      if (!node) return reject("invalid-reference", `Missing target ${op.target}`)
      if (op.target === op.parent || (isElement(node) && node.kind === "group" && flatten(node.children).some(c => c.id === op.parent))) return reject("cycle", "An item cannot contain itself")
      return insert(replace(deck, op.target, null), op.parent, op.index, node)
    }
    default: { const exhaustive: never = op; return exhaustive }
  }
}
export function apply(deck: Deck, changes: ChangeSet): ApplyResult {
  try {
    let next = deck
    for (const op of changes.changes) {
      next = change(next, op)
      validate(next)
    }
    const changedThemes = new Set([...deck.themes, ...next.themes].filter(theme => {
      const before = deck.themes.find(t => t.id === theme.id)
      const after = next.themes.find(t => t.id === theme.id)
      return before?.font !== after?.font || before?.background !== after?.background
    }).map(theme => theme.id))
    next = { ...next, slides: next.slides.map(slide => [slide.theme, ...flatten(slide.elements).map(e => e.theme)].some(theme => theme !== null && changedThemes.has(theme)) ? { ...slide } : slide) }
    const version = Math.max(deck.version, next.version, ...deck.slides.map(slide => slide.version)) + 1
    const slides = next.slides.map(slide => deck.slides.includes(slide) ? slide : { ...slide, version })
    return { ok: true, deck: { ...next, slides, version }, inverse: { changes: [{ kind: "set", target: deck.id, value: deck }] } }
  } catch (error) {
    if (!(error instanceof Rejected)) throw error
    return { ok: false, error: { code: error.code, message: error.message, retryable: false, next: "Correct the target, parent or value and retry the entire ChangeSet." } }
  }
}
