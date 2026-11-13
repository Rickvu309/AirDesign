const steps = {
  Follow: "server A starts the ask and stores its row",
  Leave: "the person leaves server A, which aborts the call",
  Mark: "server A marks the row stopped after the person left",
  StopSent: "server B marks the row stopped and notifies, or answers at once when no row runs",
  Drop: "the listen connection drops a wake",
  Reconnect: "the listen connection comes back and wakes the watcher",
  Watch: "server A reads the row and aborts a stopped call",
  Send: "server A reads the row live just before the model call and sends it",
  Skip: "server A finds the ask stopped before the model call and releases the turn uncharged",
  Settle: "server A settles the turn once",
  Forget: "server A deletes the row and notifies",
  Late: "the wait passes its bound",
  Answer: "server B answers the stop",
  NextAsk: "a new ask reserves, waits for a stopped turn, or is refused",
  NextRetry: "the new ask tries again after the wait",
  Done: "nothing is left to do",
}

export const state = (v) =>
  `call ${v.call}, model ${v.model}, row ${v.row}, charges ${v.charges}, stop ${v.stop}, next ${v.next}${v.late ? ", late" : ""}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.call === "running") return "Running"
  if (v.call === "aborted") return "Aborted"
  if (v.call === "closed") return "Closed"
  return "Before"
}

export const colors = {
  Before: "gray",
  Running: "blue",
  Aborted: "orange",
  Closed: "purple",
}

export const title = "A stop from any server closes the model call and charges it once"
