type ElementMark = { readonly mark: "element" }
type SlideMark = { readonly mark: "slide" }

export type ElementId = string & ElementMark
export type SlideId = string & SlideMark

export const elementPattern = /^(?:[0-9]{1,10}|n[0-9a-z]{12})\.(?:[0-9]{1,10}|n[0-9a-z]{12})$/

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
