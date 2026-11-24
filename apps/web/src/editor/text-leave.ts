import * as doom from "@airdesign/doom"
import { propOf } from "@airdesign/doom"

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

export function draftWrites(
  view: doom.Doom,
  draft: { readonly node: doom.NodeId; readonly keeps: boolean; readonly draft: doom.Text },
  measure: doom.Measure,
): readonly doom.Write[] {
  const leaving = leaveEmptyWrites({ ...draft, pushed: "" })
  return [
    { node: draft.node, prop: "text", value: draft.draft },
    ...(leaving.some((write) => write.prop === "parent") ? doom.freedLineEnds(view, leaving, measure) : []),
  ]
}

export function blankTextFor(painted: boolean): doom.Text {
  const blank = doom.textFromMarkdown("", "body")
  return painted
    ? { ...blank, resize: "fixed", alignV: "center", paras: [{ align: "center" }] }
    : { ...blank, resize: "height" }
}
