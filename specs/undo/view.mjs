export const state = (v) => {
  const people = v.person === 1 ? "a person row" : "no person row"
  const agent = v.hidden === 1 ? "a hidden agent row" : v.agent === 1 ? "an agent row" : "no agent row"
  if (v.track === "old") return `${people}, ${agent}`
  const later = v.laterHidden === 1 ? "a hidden later row" : v.later === 1 ? "a later row" : "no later row"
  return `${people}, ${agent}, ${later}`
}

export const step = (action) => {
  if (action === "Undo") return "undo hides the agent's row and keeps the person row"
  if (action === "Compact") return "compaction drops the hidden row"
  if (action === "StopFirst") return "the first run stops"
  if (action === "StartSecond") return "a new run starts"
  if (action === "LaterWrites") return "the later run writes"
  if (action === "UndoFirstLive") return "undo of the earlier run stays fenced while the later run is live"
  if (action === "StopSecond") return "the later run stops"
  if (action === "UndoFirst") return "undo of the earlier run hides only that run's row"
  if (action === "UndoSecond") return "undo of the later run hides only that run's row"
  if (action === "UndoFirstAgain" || action === "UndoLaterAgain") return "a second undo removes nothing more"
  return null
}

export const group = (v) => {
  if (v.track === "bothGone") return "Cleared"
  if (v.track === "firstGone") return "Hidden"
  if (v.track === "secondStopped") return "Parked"
  if (v.track === "second") return "Second"
  if (v.track === "held") return "Held"
  if (v.dropped === true) return "Compacted"
  if (v.undoMark === true) return "Undone"
  return "Open"
}

export const colors = {
  Open: "blue",
  Undone: "orange",
  Compacted: "purple",
  Held: "teal",
  Second: "red",
  Parked: "gray",
  Hidden: "blue",
  Cleared: "orange",
}

export const title = "Undo one run and leave the other run's row"
