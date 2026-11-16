import { markupDocument, type MarkupElement } from "./element-span.js"
import { slideAddresses } from "./package-address.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type TransitionKind = "fade" | "push" | "wipe"

export type SlideTransition = {
  readonly kind: TransitionKind
  readonly direction: string | null
  readonly duration: number
}

export type SlideShow = {
  readonly slide: string
  readonly part: string
  readonly hidden: boolean
  readonly transition: SlideTransition | null
}

const kinds: Readonly<Record<string, TransitionKind>> = { "p:fade": "fade", "p:push": "push", "p:wipe": "wipe" }

const speeds: Readonly<Record<string, number>> = { fast: 500, med: 750, slow: 1000 }

function attr(element: MarkupElement, name: string): string | undefined {
  return element.attributes.find((attribute) => attribute.name === name)?.value
}

function durationOf(transition: MarkupElement): number {
  const exact = Number(attr(transition, "p14:dur"))
  if (Number.isFinite(exact) && exact > 0) return exact
  return speeds[attr(transition, "spd") ?? "fast"] ?? speeds.fast!
}

function transitionOf(elements: readonly MarkupElement[]): SlideTransition | null {
  for (const transition of elements) {
    if (transition.kind !== "p:transition") continue
    const effect = elements.find((element) => element.parent === transition.index)
    const kind = effect === undefined ? undefined : kinds[effect.kind]
    if (effect === undefined || kind === undefined) continue
    const direction = kind === "fade" ? null : (attr(effect, "dir") ?? "l")
    return { kind, direction, duration: durationOf(transition) }
  }
  return null
}

export function readShows(parts: Parts): readonly SlideShow[] {
  return slideAddresses(parts).flatMap(({ slide, part }) => {
    const bytes = parts.get(part)
    if (bytes === undefined) return []
    const document = markupDocument(bytes)
    const root = document.elements.find((element) => element.kind === "p:sld")
    const show = root === undefined ? undefined : attr(root, "show")
    return [
      {
        slide,
        part,
        hidden: show === "0" || show === "false",
        transition: document.wellFormed ? transitionOf(document.elements) : null,
      },
    ]
  })
}
