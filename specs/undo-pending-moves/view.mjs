const steps = {
  PersonMove: "the person reorders the card K in frame P from a tab that has not seen the other tab's edits",
  QueueMoveInverse: "the person undoes a move within P while offline, before the other tab deletes K",
  Replay: "the person's tab catches up and sends its pending edit",
  PersonDelete: "the person deletes K",
  PersonUndo: "the person presses Ctrl+Z on deleting K",
  OtherDelete: "another tab deletes K or P",
  OtherUndo: "another tab presses Ctrl+Z",
}

const has = (bits, id) => Math.floor(bits / 2 ** id) % 2 === 1
const writer = (v, id) => (id === 0 ? "the file" : has(v.turned, id) ? `undo ${id}` : `edit ${id}`)

export const state = (v) =>
  `${v.pK === -1 ? "K is deleted" : "K is in P"} (by ${writer(v, v.wK)}), ` +
  `${v.pP === -1 ? "P is deleted" : "P is on the slide"} (by ${writer(v, v.wP)})` +
  `${v.pending === "none" ? "" : v.pending === "inverse" ? "; the move inverse is queued" : `; the pending edit is ${v.pending}`}` +
  `; ${v.theirs} undo steps in the other tab`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.pending === "queued" || v.pending === "inverse") return "Pending"
  if (v.pending !== "none") return "Replayed"
  if (v.acts > 0 || v.cut > 0) return "Stepped"
  return "Opened"
}

export const colors = { Opened: "blue", Stepped: "teal", Pending: "orange", Replayed: "purple" }

export const title =
  "A reorder or move inverse sent before the tab saw another tab delete the card and its frame, and each tab's undo around it"
