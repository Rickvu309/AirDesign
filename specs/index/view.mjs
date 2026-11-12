export const state = (value) =>
  `${value.stored} import pages stored, ${value.acked} of ${value.queued} acknowledged in the browser; revision ${value.revision}${value.upgraded ? (value.layered ? "; layouts on the server" : "; layouts queued, not on the server") : ""}`
const steps = {
  QueueImport: "the browser queues the import",
  Send: "the browser sends the next page",
  Store: "the server stores or replays a page without making an edit",
  Ack: "the browser writes its sent count",
  Crash: "the tab closes",
  Upgrade: "the deck opens with layouts and the browser queues every page again",
  Edit: "a person edits",
}
export const step = (action) => steps[action] ?? null
export const group = (value) => (value.stored === 2 ? "Ready" : value.queued === 0 ? "Missing" : "Pending")
export const colors = { Ready: "green", Missing: "gray", Pending: "orange" }
export const title = "Import pages are not edits, and a layout upgrade reaches the server"
