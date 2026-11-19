import { layerFrames, type LayerBox } from "@/present/slide-transition"
import type { LayerPairs } from "@/present/use-leaving"

function boxIn(node: HTMLElement, root: HTMLElement): LayerBox {
  let x = 0
  let y = 0
  let at: HTMLElement | null = node
  while (at !== null && at !== root) {
    x += at.offsetLeft
    y += at.offsetTop
    at = at.offsetParent instanceof HTMLElement ? at.offsetParent : null
  }
  return { x, y, width: node.offsetWidth, height: node.offsetHeight, turn: node.style.transform }
}

function layerIn(root: HTMLElement, node: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-thumb-node="${CSS.escape(node)}"]`)
}

export function morphLayers(
  outgoing: HTMLElement,
  incoming: HTMLElement,
  above: HTMLElement,
  pairs: LayerPairs,
  timing: { readonly duration: number; readonly easing: string },
): () => void {
  const hidden: HTMLElement[] = []
  const moving: Animation[] = []
  for (const [from, to] of pairs) {
    const before = layerIn(outgoing, from)
    const after = layerIn(incoming, to)
    if (before === null || after === null) continue
    const start = boxIn(before, outgoing)
    const end = boxIn(after, incoming)
    const copy = after.cloneNode(true)
    if (!(copy instanceof HTMLElement)) continue
    Object.assign(copy.style, {
      left: `${String(end.x)}px`,
      top: `${String(end.y)}px`,
      position: "absolute",
      pointerEvents: "none",
    })
    copy.removeAttribute("data-thumb-node")
    copy.setAttribute("data-present-moving", to)
    above.append(copy)
    for (const each of [before, after]) {
      each.style.visibility = "hidden"
      hidden.push(each)
    }
    moving.push(copy.animate([...layerFrames(start, end)], { ...timing, fill: "both" }))
  }
  return () => {
    for (const each of moving) each.cancel()
    above.replaceChildren()
    for (const each of hidden) each.style.visibility = ""
  }
}
