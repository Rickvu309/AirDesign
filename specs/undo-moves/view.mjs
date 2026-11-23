const steps = {
  PersonStep: "the person drags frame G or frame J into the slide or a frame that shows",
  OtherDelete: "another tab deletes frame F or frame H",
  OtherMove: "another tab drags frame G or frame J",
  Undo: "the person presses Ctrl+Z",
  Redo: "the person presses Ctrl+Shift+Z",
}

const names = { 0: "the slide", 1: "F", 2: "G", 3: "J", 4: "H" }
const has = (bits, id) => Math.floor(bits / 2 ** id) % 2 === 1
const writer = (v, id) =>
  id === 0 ? "the file" : has(v.others, id) ? "the other tab" : has(v.turned, id) ? `turn ${id}` : `step ${id}`
const depth = (stack) => (stack === 0 ? 0 : 1 + depth(Math.floor(stack / 8)))

export const state = (v) =>
  `G is in ${names[v.pG]} (by ${writer(v, v.wG)}), J is in ${names[v.pJ]} (by ${writer(v, v.wJ)})` +
  `${v.gone === 0 ? "" : `, ${names[v.gone]} is deleted`}; ` +
  `${depth(v.us)} undo and ${depth(v.rs)} redo steps` +
  `${v.told === "none" ? "" : `; the last press: ${v.told}`}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.presses > 0) return "Turning"
  if (v.acted) return "Other tab"
  if (v.made > 0) return "Stepped"
  return "Opened"
}

export const colors = { Opened: "blue", Stepped: "teal", "Other tab": "red", Turning: "orange" }

export const title =
  "Undo and redo of moves between nested frames beside another tab: a frame that is gone or now sits inside the layer never holds the steps below it"
