const textOf = (v) => {
  if (v.agent === 2 && v.personAfter === 1) return "Two agent edits and a later person"
  if (v.agent === 2) return "Two agent edits"
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

export const state = (v) => `${textOf(v)}, ${runOf(v)}`

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
  if (action === "AgentWritesAgain") return "the agent writes the fresh row"
  if (action === "AgentKeepsClaim") return "the agent writes the claimed row"
  if (action === "AgentRefusesProtected") return "the read after a person stays protected"
  if (action === "RunStops") return "the person stops the run"
  if (action === "RunUndoes") return "the person undoes the run"
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

export const title = "This model follows one run editing one property"
