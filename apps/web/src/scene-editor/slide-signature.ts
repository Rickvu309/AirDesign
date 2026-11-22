import type { scene } from "@airdesign/document"

export type SlideSignature = readonly unknown[]

function gather(view: scene.Scene, id: scene.NodeId, into: unknown[]): void {
  into.push(view.nodes.get(id))
  const children = view.children.get(id)
  into.push(children)
  for (const child of children ?? []) gather(view, child, into)
}

export function slideSignature(view: scene.Scene, slide: scene.NodeId): SlideSignature {
  const signature: unknown[] = []
  for (const node of view.nodes.values())
    if (node.type === "deck") {
      signature.push(node)
      break
    }
  gather(view, slide, signature)
  return signature
}

export function sameSignature(a: SlideSignature, b: SlideSignature): boolean {
  return a.length === b.length && a.every((each, at) => each === b[at])
}
