const steps = {
  Nudge: "the person nudges the card K, which writes its x",
  Drag: "the person drags K into the other frame, which writes its parent and its x",
  OtherMove: "another writer moves K to the other parent and writes no x",
  OtherWrite: "another writer writes K's x",
  Undo: "the person presses Ctrl+Z",
  Redo: "the person presses Ctrl+Shift+Z",
}

const names = { 0: "the slide", 1: "frame F" }
const has = (bits, id) => Math.floor(bits / 2 ** id) % 2 === 1
const writer = (v, id) =>
  id === 0 ? "the file" : has(v.others, id) ? "the other writer" : has(v.turned, id) ? `press ${id}` : `step ${id}`
const depth = (stack) => (stack === 0 ? 0 : 1 + depth(Math.floor(stack / 8)))

export const state = (v) =>
  `K is in ${names[v.p]} (by ${writer(v, v.wp)}) at x ${v.x} (by ${writer(v, v.wx)}); ` +
  `${depth(v.us)} undo and ${depth(v.rs)} redo steps` +
  `${v.told === "none" ? "" : `; the last press: ${v.told}`}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.presses > 0) return "Turning"
  if (v.acted) return "Other writer"
  if (v.made > 0) return "Stepped"
  return "Opened"
}

export const colors = { Opened: "blue", Stepped: "teal", "Other writer": "red", Turning: "orange" }

export const title =
  "Undo and redo of steps on a card's place beside another writer's move: a press never moves the card away from where the person saw it"
