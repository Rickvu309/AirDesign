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
