const rowsText = (first, second) => {
  const parts = []
  if (first === 1) parts.push("the first run's row")
  if (second === 1) parts.push("one row of the second run")
  if (second === 2) parts.push("two rows of the second run")
  return parts.length === 0 ? "no agent row" : parts.join(" and ")
}

const peopleText = (v) => {
  const count = v.person + v.secondPerson
  if (count === 0) return "no person edit"
  return count === 1 ? "a person edit" : "two person edits"
}

const runText = (v) => {
  if (v.phase === "idle") return "no run"
  const name = v.run === 1 ? "first run" : "second run"
  if (v.phase === "running" && v.guarded === true) return `${name} guarded by a person`
  if (v.phase === "running") return `${name} in progress`
  return v.phase === "stopped" ? `${name} stopped` : `${name} undone`
}

export const state = (v) => `${rowsText(v.firstRows, v.secondRows)}, ${peopleText(v)}, ${runText(v)}`

export const step = (action, from) => {
  if (action === "Done" || action === "AgentRereads") return null
  if (action === "PersonWrites" || action === "PersonWritesSecond") {
    return from.phase === "running" ? "the person edits [during the run]" : "the person edits [between runs]"
  }
  if (action === "RunStarts") return "the first run reads the property"
  if (action === "StartNext") return "a new run starts and clears the guard and the claim"
  if (action === "FirstWrites") return "the first run writes"
  if (action === "SecondWrites") return "the second run writes"
  if (action === "SecondWritesAgain") return "the second run writes the fresh row"
  if (action === "SecondKeepsClaim") return "the second run writes the claimed row"
  if (action === "SecondRefusesProtected") return "the read after a person edit stays protected"
  if (action === "RunStops") return "the person stops the run"
  if (action === "RunUndoes" || action === "SecondUndoes") return "the person undoes the run"
  return null
}

export const group = (v) => {
  if (v.phase === "idle") return "Idle"
  if (v.run === 1) return "First"
  if (v.phase === "running") return "Second"
  return v.phase === "stopped" ? "Stopped" : "Undone"
}

export const colors = {
  Idle: "blue",
  First: "orange",
  Second: "red",
  Stopped: "purple",
  Undone: "teal",
}

export const title = "Two runs on one property keep their guards and claims apart"
