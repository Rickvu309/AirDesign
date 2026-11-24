const steps = {
  Delete: "the person deletes the shape",
  Undo: "the person presses Ctrl+Z",
  Redo: "the person presses Ctrl+Shift+Z",
  SendA: "the person's tab sends its first queued edit",
  SendB: "the person's tab sends its second queued edit",
  CatchUp: "the person's tab catches up",
  BMove: "another tab moves the shape",
  BAttach: "another tab attaches the line's start to the shape",
  BEnd: "another tab moves the line's end",
}

const start = (s) => (s === -1 ? "on the shape" : s === 2 ? "free, away from the shape" : `free at box ${s}'s edge`)
const queued = (v) => [v.qa, v.qb].filter((each) => each === "queued").length

export const state = (v) =>
  `the server holds the shape ${v.xOn ? `at box ${v.xBox}` : "deleted"}, the start ${start(v.s)} and the end at ${v.e}; ` +
  `${queued(v)} edits wait to send${v.other === "none" ? "" : `; the other tab's edit (${v.other}) is ${v.seen ? "seen" : "unseen"}`}` +
  `${v.told === "none" ? "" : `; the last edit was ${v.told}`}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (!v.xOn) return "Deleted"
  if (queued(v) > 0) return "Waiting"
  if (v.other !== "none") return "Changed"
  return "Opened"
}

export const colors = { Opened: "blue", Deleted: "pink", Changed: "purple", Waiting: "orange" }

export const title =
  "A connector's ends while one tab deletes, undoes and redoes its shape late and another tab moves the shape, attaches the line or moves its end: every delete lands, and no end names a deleted shape or frees anywhere the shape never painted"
