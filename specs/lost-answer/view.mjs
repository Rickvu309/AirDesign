const steps = {
  Send: "the device sends the pending slide command with its once",
  Land: "the server lands the command, or answers where its once already landed",
  Lose: "the request or its answer is lost, and the fetch throws",
  Answer: "the device reads the answer and confirms the command",
  Reload: "the person reloads the page",
  OrphanLands: "a request the old page sent reaches the server",
  OrphanLost: "a request the old page sent never arrives",
  Adopt: "the device reads the server's deck into its mirror",
  Other: "another writer changes the deck",
}

const wire = (v) => (v.wire === "sent" ? ", a send on its way" : v.wire === "answered" ? ", an answer on its way" : "")

export const state = (v) =>
  `server at ${v.rev} holds the command ${v.lands === 0 ? "not yet" : `${v.lands === 1 ? "once" : "twice"}, from ${v.landedAt}`}; ` +
  `device ${v.known === -1 ? "has not read the deck" : `read ${v.known}`}, mirror holds it ${v.mirror === 0 ? "not" : v.mirror === 1 ? "once" : "twice"}` +
  `${v.pending ? `, row pending${v.mine ? "" : " from an earlier page"}` : ""}${wire(v)}${v.orphan === "sent" ? ", an old page's send on its way" : ""}` +
  `${v.reloads > 0 ? `, ${v.reloads} reload${v.reloads === 1 ? "" : "s"}` : ""}${v.other === 1 ? ", another writer wrote" : ""}` +
  `${v.pending && v.due ? ", a send due" : ""}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (!v.pending) return "Confirmed"
  if (v.mirror > 0) return "Landed, row still pending"
  if (v.lands > 0) return "Landed, answer unheard"
  return "Not landed"
}

export const colors = {
  "Not landed": "blue",
  "Landed, answer unheard": "orange",
  "Landed, row still pending": "purple",
  Confirmed: "green",
}

export const title =
  "A command whose answer was lost lands once, ends as one row on the device, and the deck opens in every state on the way"
