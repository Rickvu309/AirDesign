const steps = {
  Undo: "the person presses Ctrl+Z",
  Redo: "the person presses Ctrl+Shift+Z",
  OtherDelete: "another tab deletes the title",
  OtherRename: "another tab renames the deck",
  OtherRetype: "another tab retypes the title",
  GoOffline: "the person's tab goes offline",
  Reconnect: "the person's tab reconnects and replays its queue",
}

const has = (bits, id) => Math.floor(bits / 2 ** id) % 2 === 1
const writer = (v, id) =>
  id === 0 ? "the file" : has(v.others, id) ? "the other tab" : has(v.turned, id) ? `turn ${id}` : `step ${id}`
const depth = (stack) => (stack === 0 ? 0 : 1 + depth(Math.floor(stack / 8)))
const queued = (v) => [v.qa, v.qb].filter((each) => each !== 0).length

export const state = (v) =>
  `the tab shows the title's text ${v.vT} (by ${writer(v, v.vwT)}), the card's box ${v.vC} (by ${writer(v, v.vwC)}) and the deck name ${v.vN} (by ${writer(v, v.vwN)}); ` +
  `the server holds ${v.xT}, ${v.xC} and ${v.xN}${v.xP === 1 ? "" : " on a deleted title"}; ` +
  `${v.online ? "online" : `offline with ${queued(v)} queued`}; ` +
  `${depth(v.us)} undo and ${depth(v.rs)} redo steps` +
  `${v.told === "none" ? "" : `; the last press: ${v.told}`}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (!v.online) return "Offline"
  if (v.wentOff) return "Replayed"
  if (v.xP === 0) return "Deleted"
  if (v.others !== 0) return "Changed"
  return "Opened"
}

export const colors = { Opened: "blue", Deleted: "red", Changed: "purple", Offline: "orange", Replayed: "teal" }

export const title =
  "Undo and redo made offline while another tab deletes or retypes the title or renames the deck, and the deck name follows the title: on reconnect no step is lost and nothing jumps back"
