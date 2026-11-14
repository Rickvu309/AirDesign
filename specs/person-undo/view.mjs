const text = (rows) => (rows % 2 === 1 ? "the person's text" : "the text before")

export const state = (v) => {
  const onTop = v.agentRow === "shown" && v.agentField === "text" && v.agentAt === v.rowsA
  const box = v.boxA === "aira" ? "Aira's box" : "its box"
  return `A shows ${onTop ? "Aira's text" : text(v.rowsA)} and ${box}; B shows ${text(v.rowsB)}; run ${v.phase}`
}

export const step = (action) => {
  if (action === "PersonEdit") return "the person edits the text of A and B in one step"
  if (action === "AgentWrite") return "Aira writes over A's text"
  if (action === "AgentMove") return "Aira moves A"
  if (action === "AgentUndo") return "the run's Undo hides Aira's row"
  if (action === "Undo") return "the person undoes the step, or is told nothing changed"
  if (action === "Redo") return "the person redoes the step, or is told nothing changed"
  return null
}

export const group = (v) => {
  if (v.held === "dropped") return "Told"
  if (v.held === "redo") return "Undone"
  if (v.held === "undo") return "Edited"
  return "Open"
}

export const colors = { Open: "blue", Edited: "teal", Undone: "orange", Told: "gray" }

export const title = "A person's undo goes back on every element of its step, only while each still shows it"
