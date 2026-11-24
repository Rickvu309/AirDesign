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

type Leaving = {
  readonly node: doom.NodeId
  readonly keeps: boolean
  readonly draft: doom.Text
  readonly painted: doom.Text
}

const typist: doom.Author = { kind: "person", id: "typing" }

function freedByLeaving(view: doom.Doom, left: Leaving, writes: readonly doom.Write[], measure: doom.Measure) {
  if (!writes.some((write) => write.prop === "parent")) return []
  const seen = doom.viewOf(view, [
    { once: "painted-draft", author: typist, writes: [{ node: left.node, prop: "text", value: left.painted }] },
  ])
  return doom.freedLineEnds(seen, writes, measure)
}

export function draftWrites(view: doom.Doom, draft: Leaving, measure: doom.Measure): readonly doom.Write[] {
  const leaving = leaveEmptyWrites({ ...draft, pushed: "" })
  return [{ node: draft.node, prop: "text", value: draft.draft }, ...freedByLeaving(view, draft, leaving, measure)]
}

export function leaveWrites(
  view: doom.Doom,
  left: Leaving & { readonly pushed: string },
  measure: doom.Measure,
): readonly doom.Write[] {
  const leaving = leaveEmptyWrites(left)
  return [...freedByLeaving(view, left, leaving, measure), ...leaving]
}

export function blankTextFor(painted: boolean): doom.Text {
  const blank = doom.textFromMarkdown("", "body")
  return painted
    ? { ...blank, resize: "fixed", alignV: "center", paras: [{ align: "center" }] }
    : { ...blank, resize: "height" }
}
