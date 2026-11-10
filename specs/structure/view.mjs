const presentText = (v) => {
  const names = []
  if (v.nodeA === true) names.push("a")
  if (v.nodeB === true) names.push("b")
  return names.length === 0 ? "none" : names.join(" and ")
}

const readAccepts = (v) => v.readId === v.runId && (v.phase === "stopped" || v.phase === "undone")

export const state = (v) => {
  const memory = v.didRead === true ? ", the read holds the nodes" : ""
  return `present ${presentText(v)}, run ${v.runId} read ${v.readId} ${v.phase}${memory}`
}

export const step = (action, from) => {
  if (action === "AddNode") return "the edit adds node b"
  if (action === "RemoveNode") return "the edit removes node b"
  if (action === "SecondRunReads" && readAccepts(from)) return "the read stores the present nodes"
  if (action === "SecondRunReads") return "the read stays fenced"
  if (action === "NameAbsent") return "the edit names a missing node"
  return null
}

export const group = (v) => {
  if (v.record === "add") return "Added"
  if (v.record === "remove") return "Removed"
  return "Unchanged"
}

export const colors = {
  Unchanged: "blue",
  Added: "orange",
  Removed: "purple",
}

export const title = "Name the nodes an edit adds or removes"
