import * as doom from "@airdesign/doom"
import { propOf } from "@/editing/node-props"

export function holdsPaint(view: doom.Doom, id: doom.NodeId): boolean {
  const node = view.nodes.get(id)
  return (propOf(node, "fills")?.length ?? 0) > 0 || (propOf(node, "strokes")?.length ?? 0) > 0
}

export function leaveEmptyWrites(left: {
  readonly node: doom.NodeId
  readonly keeps: boolean
  readonly draft: doom.Text
  readonly pushed: string
}): readonly doom.Write[] {
  if (left.draft.chars !== "") return []
  if (!left.keeps) return [{ node: left.node, prop: "parent", value: null }]
  return JSON.stringify(left.draft) === left.pushed ? [] : [{ node: left.node, prop: "text", value: left.draft }]
}

export function blankTextFor(painted: boolean): doom.Text {
  const blank = doom.textFromMarkdown("", "body")
  return painted
    ? { ...blank, resize: "fixed", alignV: "center", paras: [{ align: "center" }] }
    : { ...blank, resize: "height" }
}
