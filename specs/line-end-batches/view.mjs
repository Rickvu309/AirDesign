const kinds = { none: "", delete: "deletes X", shelve: "moves X into a frame off the deck" }
const ops = {
  none: "",
  newN: "creates line N",
  moveL: "moves line L into another frame",
  lineM: "turns shape M into a line by its geometry alone",
}
const frames = { none: "", drop: "deletes frame F", restore: "restores frame F and the line R inside it" }
const end = (value) => (value === "free" ? "free" : `on ${value}`)

const batch = (v) =>
  [kinds[v.k], frames[v.f], v.o === "none" ? "" : `${ops[v.o]} with its start ${end(v.a)}`]
    .filter(Boolean)
    .join(" and ")

export const state = (v) =>
  `X ${v.xOn ? "is on the deck" : "is off the deck"}, L's start is ${end(v.s)}` +
  `${v.nOn ? `, N's start is ${end(v.ns)}` : ""}` +
  `${v.mOn ? `, M's start is ${end(v.ms)}` : ""}` +
  `, F ${v.fOn ? "is on the deck" : "is off the deck"}` +
  `${v.got === "none" ? "" : `; the last batch ${batch(v)}: the server ${v.got} it, the whole deck ${v.agrees ? "agrees" : "disagrees"}`}`

export const step = (action) => (action === "Send" ? "an agent or a tab sends one batch" : null)

export const group = (v) =>
  v.got === "none" ? "Opened" : v.got === "refused" ? "Refused" : v.xOn ? "Landed" : "Removed"

export const colors = { Opened: "blue", Landed: "teal", Removed: "purple", Refused: "orange" }

export const title =
  "One batch beside two shapes a line may attach to: a delete or a move into a frame off the deck, a new, moved or redrawn line, or a frame restored with a line inside, never leaves an end on a shape off the deck, and the server's partial fold decides as the whole deck"
