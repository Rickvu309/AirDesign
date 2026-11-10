const runText = (v) => (v.runId === "none" ? "no run" : `run ${v.runId}`)

const writeText = (v) => (v.writes === 0 ? "no writes" : "one write")

const readText = (v) => (v.didRead === true ? ", the read landed" : "")

const readAccepts = (v, id) => v.didRead === false && v.runId === id && (v.phase === "stopped" || v.phase === "undone")

export const state = (v) => `${runText(v)} ${v.phase}, ${writeText(v)}${readText(v)}`

export const step = (action, from) => {
  if (action === "Start") return "the run starts"
  if (action === "StartAgain") return "a start during a live run stays fenced"
  if (action === "StartNext") return "a new run starts after the earlier one ends"
  if (action === "StartReuse") return "a start that reuses an id with a row stays fenced"
  if (action === "UndoEarlier" && from.phase === "running")
    return "undo of an earlier run stays fenced while a run is live"
  if (action === "UndoEarlier") return "undo of an earlier run hides only that run's row"
  if (action === "UndoEarlierLive") return "undo of an earlier run stays fenced while a run is live"
  if (action === "UndoEarlierAgain") return "a second undo of an earlier run removes nothing"
  if (action === "Stop") return "the person stops the run"
  if (action === "StopMiss") return "a stop for the other run stays fenced"
  if (action === "Limit") return "a limit ends the run"
  if (action === "Resume") return "the run resumes"
  if (action === "AgentWrites" && from.phase !== "running") return "the write stays fenced"
  if (action === "AgentWrites") return "the agent writes"
  if (action === "AgentMiss") return "a write for the other run stays fenced"
  if (action === "Undo") return "the person undoes the run"
  if (action === "ReadS" && readAccepts(from, "s")) return "the read stores the present nodes"
  if (action === "ReadT" && readAccepts(from, "t")) return "the read stores the present nodes"
  if (action === "ReadS" || action === "ReadT") return "the read stays fenced"
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

export const title = "A run starts, stops, resumes, and a later run can follow"
