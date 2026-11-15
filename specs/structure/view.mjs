const presentText = (v) => {
  const names = []
  if (v.nodeA === true) names.push("a")
  if (v.nodeB === true) names.push("b")
  return names.length === 0 ? "none" : names.join(" and ")
}

const readAccepts = (v) => v.readId === v.runId && (v.phase === "stopped" || v.phase === "undone")

const shown = (v) => (v.grouped === "formed" ? v.inside + v.offset : v.own)

export const state = (v) => {
  const memory = v.didRead === true ? ", the read holds the nodes" : ""
  const tree =
    v.grouped === undefined || v.grouped === "none"
      ? ""
      : `, group ${v.grouped} by ${v.maker}, moved ${v.offset}, child at ${shown(v)} where the person saw ${v.seen}`
  return `present ${presentText(v)}, run ${v.runId} read ${v.readId} ${v.phase}${memory}${tree}`
}

export const step = (action, from) => {
  if (action === "AddNode") return "the edit adds node b"
  if (action === "RemoveNode") return "the edit removes node b"
  if (action === "SecondRunReads" && readAccepts(from)) return "the read stores the present nodes"
  if (action === "SecondRunReads") return "the read stays fenced"
  if (action === "NameAbsent") return "the edit names a missing node"
  if (action === "GroupBy") return "the person or the agent groups the child"
  if (action === "MoveGroup") return "the person moves the group"
  if (action === "UndoMoveGroup") return "the person undoes the group's move"
  if (action === "MoveChild") return "the person moves the child on the slide"
  if (action === "UndoMoveChild") return "the person undoes the child's move"
  if (action === "Ungroup") return "the person ungroups, or undoes the group"
  if (action === "Regroup") return "the person undoes the ungroup, or redoes the group"
  if (action === "RunUndo" && from.touched !== true && from.own === from.inside)
    return "the run's Undo ungroups the agent's group"
  if (action === "RunUndo") return "the run's Undo refuses, since the person changed the group"
  return null
}

export const group = (v) => {
  if (v.grouped === "formed") return "Grouped"
  if (v.grouped === "dissolved") return "Ungrouped"
  if (v.record === "add") return "Added"
  if (v.record === "remove") return "Removed"
  return "Unchanged"
}

export const colors = {
  Unchanged: "blue",
  Added: "orange",
  Removed: "purple",
  Grouped: "green",
  Ungrouped: "red",
}

export const title = "Name the nodes an edit adds or removes, and keep each child in place through group and ungroup"
