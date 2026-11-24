import type * as doom from "@airdesign/doom"
import { propOf } from "@airdesign/doom"

export type ShowPoint = { readonly x: number; readonly y: number; readonly show: Element }

const under = (element: Element, { x, y }: ShowPoint): boolean =>
  [...element.getClientRects()].some((box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)

export function linkAt(view: doom.Doom, point: ShowPoint): string | undefined {
  const slide = point.show.querySelector("[data-present-slide]")
  const top =
    slide === null ? undefined : [...slide.querySelectorAll("[data-node]")].findLast((layer) => under(layer, point))
  if (top === undefined) return undefined
  const words = [...top.querySelectorAll("[data-link]")].find(
    (run) => run.closest("[data-node]") === top && under(run, point),
  )
  if (words !== undefined) return words.getAttribute("data-link") ?? undefined
  for (let layer: Element | null = top; layer !== null; layer = layer.parentElement?.closest("[data-node]") ?? null) {
    const link = propOf(view.nodes.get(layer.getAttribute("data-node") as doom.NodeId), "link")
    if (link !== undefined) return link
  }
  return undefined
}

const address = /^(https?:|mailto:)/i

export function followLink(link: string, slides: readonly doom.NodeId[], go: (index: number) => void): boolean {
  const at = slides.indexOf(link as doom.NodeId)
  if (at >= 0) {
    go(at)
    return true
  }
  if (!address.test(link)) return false
  window.open(link, "_blank", "noopener,noreferrer")
  return true
}
