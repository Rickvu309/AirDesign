const steps = {
  PersonStep:
    "the person nudges the card, changes the title's text, the card's box or both in one step, types in the title and deletes it in one step, or makes the title and nudges the card in one step",
  OtherWrite: "another tab changes the title's text or the card's box",
  OtherDelete: "another tab deletes the title",
  Undo: "the person presses Ctrl+Z",
  Redo: "the person presses Ctrl+Shift+Z",
}

const has = (bits, id) => Math.floor(bits / 2 ** id) % 2 === 1
const writer = (v, id) =>
  id === 0 ? "the file" : has(v.others, id) ? "the other tab" : has(v.turned, id) ? `turn ${id}` : `step ${id}`
const depth = (stack) => (stack === 0 ? 0 : 1 + depth(Math.floor(stack / 8)))
const titleOf = (v) =>
  v.xP === 2
    ? "the title is not made yet"
    : `the title's text is ${v.xT} (by ${writer(v, v.wT)})` +
      (v.xP === 1 ? "" : ` on a title deleted by ${writer(v, v.wP)}`)

export const state = (v) =>
  `${titleOf(v)}, the card's box is ${v.xC} (by ${writer(v, v.wC)}); ` +
  `${depth(v.us)} undo and ${depth(v.rs)} redo steps` +
  `${v.told === "none" ? "" : `; the last press: ${v.told}`}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.presses > 0) return "Turning"
  if (v.xP === 0) return "Deleted"
  if (v.made > 0) return "Stepped"
  return "Opened"
}

export const colors = { Opened: "blue", Stepped: "teal", Deleted: "red", Turning: "orange" }

export const title =
  "Undo and redo on one device beside another tab: neither a deleted layer nor a step that deletes its own layer holds the steps below it"
