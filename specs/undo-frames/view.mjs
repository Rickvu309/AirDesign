const steps = {
  PersonDrag: "the person drags the card K into frame G or frame H",
  PersonFrame: "the person frames K (Ctrl+Alt+G): a new frame X where K is, holding K",
  OtherDelete: "another tab deletes frame F, G or H",
  OtherDrag: "another tab drags K into G, H or X, or H into X",
  Undo: "the person presses Ctrl+Z",
  Redo: "the person presses Ctrl+Shift+Z",
}

const names = { "-1": "nowhere", 0: "the slide", 1: "F", 2: "G", 3: "K", 4: "H", 5: "X" }
const has = (bits, id) => Math.floor(bits / 2 ** id) % 2 === 1
const writer = (v, id) =>
  id === 0 ? "the file" : has(v.others, id) ? "the other tab" : has(v.turned, id) ? `turn ${id}` : `step ${id}`
const depth = (stack) => (stack === 0 ? 0 : 1 + depth(Math.floor(stack / 8)))

export const state = (v) =>
  `K is in ${names[v.pK]} (by ${writer(v, v.wK)}), H is in ${names[v.pH]}, ` +
  `${v.pX === -1 ? (v.wX === 0 ? "X is not made" : "X is deleted") : `X is in ${names[v.pX]}`}` +
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
  "Undo and redo of framing a layer beside another tab: a frame the undo deletes never takes a layer with it"
