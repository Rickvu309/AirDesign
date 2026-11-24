const steps = {
  PersonMove: "the person reorders the card K in frame P from a tab that has not seen the other tab's edits",
  Replay: "the person's tab catches up and sends the reorder",
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
  `${v.pending === "none" ? "" : `; the reorder is ${v.pending}`}` +
  `; ${v.theirs} undo steps in the other tab`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.pending === "queued") return "Pending"
  if (v.pending !== "none") return "Replayed"
  if (v.acts > 0 || v.cut > 0) return "Stepped"
  return "Opened"
}

export const colors = { Opened: "blue", Stepped: "teal", Pending: "orange", Replayed: "red" }

export const title =
  "A reorder sent before the tab saw another tab delete the card and its frame, and each tab's undo around it"
