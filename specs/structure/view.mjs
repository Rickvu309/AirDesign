const presentText = (v) => {
  const names = []
  if (v.nodeA === true) names.push("a")
  if (v.nodeB === true) names.push("b")
  return names.length === 0 ? "none" : names.join(" and ")
}

export const state = (v) => {
  const memory = v.didRead === true ? ", the second run remembers the nodes" : ""
  return `present ${presentText(v)}${memory}`
}

export const step = (action) => {
  if (action === "AddNode") return "the edit adds node b"
  if (action === "RemoveNode") return "the edit removes node b"
  if (action === "SecondRunReads") return "the second run reads the present nodes"
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
