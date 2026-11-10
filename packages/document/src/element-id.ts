type ElementMark = { readonly mark: "element" }
type SlideMark = { readonly mark: "slide" }

export type ElementId = string & ElementMark
export type SlideId = string & SlideMark

export function elementId(value: string): ElementId {
  return value as ElementId
}

export function slideId(value: string): SlideId {
  return value as SlideId
}

export function shapeOf(id: ElementId): { readonly slide: string; readonly shape: string } {
  const dot = id.indexOf(".")
  if (dot < 0) {
    throw new Error("element id")
  }
  return { slide: id.slice(0, dot), shape: id.slice(dot + 1) }
}
