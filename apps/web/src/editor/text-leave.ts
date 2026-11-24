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

const overlaid = (view: doom.Doom, once: string, writes: readonly doom.Write[]) =>
  doom.viewOf(view, [{ once, author: typist, writes }])

const paintedIn = (view: doom.Doom, left: Leaving) =>
  overlaid(view, "painted-draft", [{ node: left.node, prop: "text", value: left.painted }])

export function draftWrites(view: doom.Doom, draft: Leaving, measure: doom.Measure): readonly doom.Write[] {
  const typed: doom.Write = { node: draft.node, prop: "text", value: draft.draft }
  const lost = doom.lostBy(view, leaveEmptyWrites({ ...draft, pushed: "" }))
  if (lost.length === 0) return [typed]
  return [typed, ...doom.freedEnds(paintedIn(view, draft), overlaid(view, "draft", [typed]), lost, measure)]
}

export function leaveWrites(
  view: doom.Doom,
  left: Leaving & { readonly pushed: string },
): { readonly writes: readonly doom.Write[]; readonly seen: doom.Doom } {
  return { writes: leaveEmptyWrites(left), seen: paintedIn(view, left) }
}

export function blankTextFor(painted: boolean): doom.Text {
  const blank = doom.textFromMarkdown("", "body")
  return painted
    ? { ...blank, resize: "fixed", alignV: "center", paras: [{ align: "center" }] }
    : { ...blank, resize: "height" }
}
