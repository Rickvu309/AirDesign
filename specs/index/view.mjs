export const state = (value) =>
  `${value.stored} format ${value.format} pages stored, ${value.acked} of ${value.queued} acknowledged in the browser; revision ${value.revision}${value.resent ? (value.format === 2 ? "; the newer index swapped in" : value.drift ? "; the re-sent index reads its opening values differently, so the server refuses it" : `; ${value.beside} newer page built beside`) : ""}`
const steps = {
  QueueImport: "an older build queues the import",
  Send: "the browser sends the next page",
  Store: "the server stores, builds beside, swaps in, replays or refuses a page without making an edit",
  Ack: "the browser writes its sent count",
  Crash: "the tab closes",
  Resend: "a device at a higher format opens the deck and queues every page again",
  Edit: "a person edits",
}
export const step = (action) => steps[action] ?? null
export const group = (value) =>
  value.format === 2 ? "Newer" : value.stored === 2 ? "Ready" : value.queued === 0 ? "Missing" : "Pending"
export const colors = { Newer: "green", Ready: "blue", Missing: "gray", Pending: "orange" }
export const title = "Import pages are not edits, and a higher format's index swaps in whole"
