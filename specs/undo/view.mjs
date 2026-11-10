export const state = (v) => {
  const people = v.person === 1 ? "a person row" : "no person row"
  const agent = v.hidden === 1 ? "a hidden agent row" : v.agent === 1 ? "an agent row" : "no agent row"
  return `${people}, ${agent}`
}

export const step = (action) => {
  if (action === "Undo") return "undo hides the agent's row and keeps the person row"
  if (action === "Compact") return "compaction drops the hidden row"
  return null
}

export const group = (v) => {
  if (v.dropped === true) return "Compacted"
  if (v.undoMark === true) return "Undone"
  return "Open"
}

export const colors = {
  Open: "blue",
  Undone: "orange",
  Compacted: "purple",
}

export const title = "Undo a run and compact the hidden row"
