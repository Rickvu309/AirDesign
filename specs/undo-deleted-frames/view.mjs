const steps = {
  PersonStep: "the person drags the card K into frame H, and may paint it in the same edit, or deletes K",
  OtherDelete: "another tab deletes frame F or frame G",
  OtherPaint: "another tab paints K",
  OtherUndo: "another tab presses Ctrl+Z, which brings back the frame it deleted",
  Undo: "the person presses Ctrl+Z",
  Redo: "the person presses Ctrl+Shift+Z",
}

const names = { "-1": "nowhere", 0: "the slide", 1: "F", 2: "G", 4: "H" }
const paints = ["blue", "red"]
const has = (bits, id) => Math.floor(bits / 2 ** id) % 2 === 1
const writer = (v, id) =>
  id === 0 ? "the file" : has(v.others, id) ? "the other tab" : has(v.turned, id) ? `turn ${id}` : `step ${id}`
const depth = (stack) => (stack === 0 ? 0 : 1 + depth(Math.floor(stack / 8)))

export const state = (v) =>
  `${v.pK === -1 ? "K is deleted" : `K is in ${names[v.pK]}`} (by ${writer(v, v.wK)}), ` +
  `${paints[v.cK]} (by ${writer(v, v.wC)})` +
  `${v.gone === 0 ? "" : `, ${names[v.gone]} is deleted`}; ` +
  `${depth(v.us)} undo and ${depth(v.rs)} redo steps` +
  `${v.told === "none" ? "" : `; the last press: ${v.told}`}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.presses > 0) return "Turning"
  if (v.acts > 0) return "Other tab"
  if (v.made > 0) return "Stepped"
  return "Opened"
}

export const colors = { Opened: "blue", Stepped: "teal", "Other tab": "red", Turning: "orange" }

export const title =
  "Undo and redo of a step on a card whose frame another tab deleted: the card's colour and the card itself come back"
