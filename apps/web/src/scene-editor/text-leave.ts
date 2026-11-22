import { scene } from "@airdesign/document"
import { propOf } from "./node-props"

export function holdsPaint(view: scene.Scene, id: scene.NodeId): boolean {
  const node = view.nodes.get(id)
  return (propOf(node, "fills")?.length ?? 0) > 0 || (propOf(node, "strokes")?.length ?? 0) > 0
}

export function leaveEmptyWrites(left: {
  readonly node: scene.NodeId
  readonly keeps: boolean
  readonly draft: scene.Text
  readonly pushed: string
}): readonly scene.Write[] {
  if (left.draft.chars !== "") return []
  if (!left.keeps) return [{ node: left.node, prop: "parent", value: null }]
  return JSON.stringify(left.draft) === left.pushed ? [] : [{ node: left.node, prop: "text", value: left.draft }]
}

export function blankTextFor(painted: boolean): scene.Text {
  const blank = scene.textFromMarkdown("", "body")
  return painted
    ? { ...blank, resize: "fixed", alignV: "center", paras: [{ align: "center" }] }
    : { ...blank, resize: "height" }
}
