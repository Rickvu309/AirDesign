export const state = (v) => {
  const shown =
    v.agentRow === "shown" && v.agentAt === v.personRows
      ? "Aira's text"
      : v.personRows % 2 === 1
        ? "the person's text"
        : "the text before"
  return `shows ${shown}; ${v.personRows} person rows; run ${v.phase}`
}

export const step = (action) => {
  if (action === "PersonEdit") return "the person edits the text"
  if (action === "AgentWrite") return "Aira writes over it"
  if (action === "AgentUndo") return "the run's Undo hides Aira's row"
  if (action === "Undo") return "the person undoes, or is told nothing changed"
  if (action === "Redo") return "the person redoes, or is told nothing changed"
  return null
}

export const group = (v) => {
  if (v.held === "dropped") return "Told"
  if (v.held === "redo") return "Undone"
  if (v.held === "undo") return "Edited"
  return "Open"
}

export const colors = { Open: "blue", Edited: "teal", Undone: "orange", Told: "gray" }

export const title = "A person's undo goes back only while their edit still shows"
