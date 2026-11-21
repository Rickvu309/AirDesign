const steps = {
  Land: "the server accepts an edit and the page paints again",
  Try: "the page writes the edits it has not left out, or leaves out the first that does not write",
  Reload: "the person reloads the page",
}

const bits = (mask, count) =>
  Array.from({ length: count }, (_, at) => at + 1).filter((edit) => Math.floor(mask / 2 ** (edit - 1)) % 2 === 1)

const edits = (v) =>
  Array.from(
    { length: v.count },
    (_, at) => `${at + 1}${bits(v.bad, v.count).includes(at + 1) ? " (cannot write)" : ""}`,
  ).join(", ")

export const state = (v) =>
  `edits ${edits(v) || "none"}; page ${v.phase === "open" ? `open, painting ${bits(v.shown, v.count).join(", ") || "the file"}` : "painting"}` +
  `${v.left > 0 ? `, left out ${bits(v.left, v.count).join(", ")}` : ""}${v.told ? ", the person told" : ""}` +
  `${v.reloads > 0 ? ", reloaded" : ""}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.phase !== "open") return "Painting"
  return v.told ? "Open, edits left out" : "Open, every edit shown"
}

export const colors = {
  Painting: "blue",
  "Open, every edit shown": "green",
  "Open, edits left out": "orange",
}

export const title =
  "Every accepted edit the tab can write is shown, the rest are left out with a notice, and the deck always opens"
