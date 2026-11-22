import { decide, format, groupParent, readLayout, type Box, type ElementId, type Register } from "@airdesign/document"
import { commitPatch, type BoxCommit } from "@/editing/commit-edit"

function autoFrame(register: Register, node: ElementId): boolean {
  const view = readLayout(register, node)
  return view !== null && view.flow !== "none"
}

function topFrame(register: Register, node: ElementId): ElementId | null {
  let top = autoFrame(register, node) ? node : null
  let above = groupParent(register, node) ?? null
  while (above !== null && autoFrame(register, above)) {
    top = above
    above = groupParent(register, above) ?? null
  }
  return top
}

function landed(register: Register, commit: BoxCommit): Register {
  const node = commit.element.id
  const opened = register.nodes.includes(node)
    ? null
    : decide(register, { command: "add", node, floor: commit.element.file, route: "" })
  const start = opened?.decision === "apply" ? opened.register : register
  const patch = commitPatch(commit.box, commit, "after")
  const decision = decide(start, { command: "person", node, v: format, patch })
  return decision.decision === "apply" ? decision.register : register
}

function collect(register: Register, frame: ElementId, laid: Map<ElementId, Box>): void {
  const view = readLayout(register, frame)
  if (view === null) return
  laid.set(frame, view.box)
  laid.set(view.backdrop, view.box)
  for (const child of view.children) {
    laid.set(child.node, child.box)
    collect(register, child.node, laid)
  }
}

export function relaidBoxes(
  framing: Register | null,
  commits: readonly BoxCommit[],
): ReadonlyMap<ElementId, Box> | null {
  if (framing === null) return null
  const tops = [...new Set(commits.flatMap(({ element }) => topFrame(framing, element.id) ?? []))]
  if (tops.length === 0) return null
  const register = commits.reduce(landed, framing)
  const laid = new Map<ElementId, Box>()
  for (const top of tops) collect(register, top, laid)
  return laid
}

export function draggedSize(box: Box, now: Box | undefined, grip: string): Box {
  if (now === undefined) return box
  const width = grip.includes("left") || grip.includes("right")
  const height = grip.includes("top") || grip.includes("bottom")
  return { ...box, cx: width ? box.cx : now.cx, cy: height ? box.cy : now.cy }
}
