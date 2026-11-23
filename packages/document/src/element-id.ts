type ElementMark = { readonly mark: "element" }
type SlideMark = { readonly mark: "slide" }

export type ElementId = string & ElementMark
export type SlideId = string & SlideMark

export const slideKinds = ["notes", "slide"] as const

export const templateStylesNode = "deck.templateStyles" as ElementId

export const elementPattern = new RegExp(
  `^(?:(?:[0-9]{1,10}|n[0-9a-z]{12})\\.(?:[0-9]{1,10}|n[0-9a-z]{12}|${slideKinds.join("|")})|deck\\.templateStyle(?:s|[1-9][0-9]{0,3}))$`,
)

const nodeAliases: readonly { readonly alias: RegExp; readonly node: string }[] = [
  { alias: /^deck\.theme$/, node: templateStylesNode },
  { alias: /^deck\.template([1-9][0-9]{0,3})$/, node: "deck.templateStyle$1" },
]

export function readElementId(raw: unknown): ElementId | undefined {
  if (typeof raw !== "string") return undefined
  const named = nodeAliases.reduce((node, { alias, node: current }) => node.replace(alias, current), raw)
  return elementPattern.test(named) ? (named as ElementId) : undefined
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

export function shapeOf(id: ElementId): { readonly slide: string; readonly shape: string } {
  const dot = id.indexOf(".")
  if (dot < 0) {
    throw new Error("element id")
  }
  return { slide: id.slice(0, dot), shape: id.slice(dot + 1) }
}
