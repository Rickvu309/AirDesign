const unsentCount = (v) => {
  let count = 0
  if (v.queued1 === true && v.acked1 === false) count += 1
  if (v.queued2 === true) count += 1
  if (v.stale === true && v.skipped === false && v.landedStale === false) count += 1
  if (v.journaled === true) count += 1
  return count
}

export const state = (v) => {
  const count = unsentCount(v)
  const noun = count === 1 ? "edit" : "edits"
  return `${count} unsent ${noun}`
}

export const step = (action) => {
  if (action === "Type") return "a typed edit is painted and kept in the journal at once"
  if (action === "QueueFirst") return "the device holds the edit, so the journal lets it go"
  if (action === "Send" || action === "SendNext") return "the later edit waits until the earlier one is sent"
  if (action === "Ack") return "the server acknowledges the next edit"
  if (action === "Skip") return "a stale edit is skipped"
  if (action === "Crash") return "a crash keeps the unsent edits"
  if (action === "Wipe") return "a wipe clears the unsent edits"
  return null
}

export const group = (v) => {
  if (v.wiped === true) return "Wiped"
  if (v.crashed === true) return "Crashed"
  if (v.skipped === true) return "Skipped"
  if (v.acked1 === true) return "Acknowledged"
  if (v.sent1 === true || v.sent2 === true) return "Sent"
  return "Open"
}

export const colors = {
  Open: "blue",
  Sent: "orange",
  Acknowledged: "purple",
  Skipped: "teal",
  Crashed: "red",
  Wiped: "gray",
}

export const title = "Replay the unsent edits in order"
