type ElementMark = { readonly mark: "element" }
type SlideMark = { readonly mark: "slide" }

export type ElementId = string & ElementMark
export type SlideId = string & SlideMark

export const slideKinds = ["notes", "slide"] as const

export type SlideKind = (typeof slideKinds)[number]

export const themeNode = "deck.theme" as ElementId

export const elementPattern = new RegExp(
  `^(?:(?:[0-9]{1,10}|n[0-9a-z]{12})\\.(?:[0-9]{1,10}|n[0-9a-z]{12}|${slideKinds.join("|")})|deck\\.(?:theme|template[1-9][0-9]{0,3}))$`,
)

export const rootElement = "a" as ElementId
export const legacyElement = "b" as ElementId

export function readElementId(raw: unknown): ElementId | undefined {
  if (typeof raw !== "string" || !elementPattern.test(raw)) return undefined
  return raw as ElementId
}

export function elementId(value: string): ElementId {
  const read = readElementId(value)
  if (read === undefined) {
    throw new Error("element id")
  }
  return read
}

const slidePattern = /^[0-9]{1,10}$/

export function readSlideId(raw: unknown): SlideId | undefined {
  if (typeof raw !== "string" || !slidePattern.test(raw)) return undefined
  return raw as SlideId
}

export function slideId(value: string): SlideId {
  return value as SlideId
}

export function storedElements(register: { readonly elements: object }): readonly ElementId[] {
  const stored: ElementId[] = []
  for (const key of Object.keys(register.elements)) {
    if (key === rootElement) {
      stored.push(rootElement)
      continue
    }
    if (key === legacyElement) {
      stored.push(legacyElement)
      continue
    }
    const read = readElementId(key)
    if (read !== undefined) stored.push(read)
  }
  return stored
}

export function shapeOf(id: ElementId): { readonly slide: string; readonly shape: string } {
  const dot = id.indexOf(".")
  if (dot < 0) {
    throw new Error("element id")
  }
  return { slide: id.slice(0, dot), shape: id.slice(dot + 1) }
}

export function slideKind(node: ElementId): SlideKind | null {
  const shape = node.slice(node.indexOf(".") + 1)
  return slideKinds.find((kind) => kind === shape) ?? null
}

export function slideNode(slide: SlideId, kind: SlideKind): ElementId {
  return `${slide}.${kind}` as ElementId
}

export function templateNode(index: number): ElementId {
  return elementId(`deck.template${index + 1}`)
}

export function templateIndex(node: string): number | null {
  const match = /^deck\.template([1-9][0-9]{0,3})$/.exec(node)
  return match === null ? null : Number(match[1]) - 1
}

export function themeOwned(node: string): boolean {
  return node === themeNode || templateIndex(node) !== null
}
