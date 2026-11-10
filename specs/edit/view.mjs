const textOf = (v) => {
  if (v.personAfter === 1) return "Later person edit"
  if (v.agent === 1) return "Agent edit"
  if (v.personBefore === 1) return "Person edit"
  return "Original"
}

const runOf = (v) => {
  if (v.phase === "idle") return "no run"
  if (v.phase === "running" && v.guarded === true) return "person is guarding"
  if (v.phase === "running") return "run in progress"
  if (v.phase === "stopped") return "run stopped"
  return "run undone"
}

const presentText = (v) => {
  if (v.nodeA !== true && v.nodeA !== false) return ""
  const names = []
  if (v.nodeA === true) names.push("a")
  if (v.nodeB === true) names.push("b")
  const label = names.length === 0 ? "none" : names.join(" and ")
  return `, present ${label}`
}

const memoryText = (v) => (v.didRead === true ? ", the second run remembers the nodes" : "")

export const state = (v) => `${textOf(v)}, ${runOf(v)}${presentText(v)}${memoryText(v)}`

export const step = (action, from) => {
  if (action === "Done" || action === "AgentRereads") return null
  if (action === "PersonWrites" && from.phase === "running") {
    return "the person edits [during the run]"
  }
  if (action === "PersonWrites" && from.phase === "stopped") {
    return "the person edits [after stop]"
  }
  if (action === "PersonWrites" && from.phase === "undone") {
    return "the person edits [after undo]"
  }
  if (action === "PersonWrites") return "the person edits"
  if (action === "RunStarts") return "the run reads the property"
  if (action === "AgentWrites") return "the agent writes"
  if (action === "RunStops") return "the person stops the run"
  if (action === "RunUndoes") return "the person undoes the run"
  if (action === "AddNode") return "the edit adds node b"
  if (action === "RemoveNode") return "the edit removes node b"
  if (action === "SecondRunReads") return "the second run reads the present nodes"
  if (action === "NameAbsent") return "the edit names a missing node"
  return null
}

export const group = (v) => {
  if (v.phase === "idle") return "Idle"
  if (v.phase === "running") return "Running"
  if (v.phase === "stopped") return "Stopped"
  return "Undone"
}

export const colors = {
  Idle: "blue",
  Running: "orange",
  Stopped: "purple",
  Undone: "teal",
}

export const title = "One person and one agent edit one property"
