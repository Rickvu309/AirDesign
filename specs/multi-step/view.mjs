const listed = (names) => (names.length === 0 ? "nothing" : names.join(" and "))
const both = (value, key) => ["A", "B"].filter((name) => value[`${key}${name}`] === true)
const held = {
  empty: "nothing to undo",
  undo: "can undo the step",
  redo: "can redo the step",
  dropped: "told nothing changed",
}
const agent = (value) => {
  if (value.agent === "delete") return [`an agent deleted ${value.agentOn}`]
  if (value.agent !== "write") return []
  return [
    `${value.agentOn} shows an agent's row ${value.since ? "written since the Delete" : "from before the Delete"}`,
  ]
}

export const state = (value) =>
  [
    `${listed(both(value, "shown"))} on the slide`,
    ...(value.lockedA ? ["A animated"] : []),
    ...(value.refusedA ? ["told A could not be deleted"] : []),
    ...agent(value),
    ...(value.held === "undo" || value.held === "redo" ? [`the step names ${listed(both(value, "named"))}`] : []),
    held[value.held] ?? value.held,
  ].join(", ")

export const step = (action) => {
  if (action === "Delete") return "the person presses Delete with every element that shows chosen"
  if (action === "AgentDelete") return "an agent deletes an element"
  if (action === "AgentWrite") return "an agent writes in an element"
  if (action === "Undo") return "the person undoes the step, or is told nothing changed"
  if (action === "Redo") return "the person redoes the step, or is told nothing changed"
  return null
}

export const group = (value) => {
  if (value.held === "dropped") return "Told"
  if (value.held === "redo") return "Undone"
  if (value.held === "undo") return "Deleted"
  return "Open"
}

export const colors = { Open: "blue", Deleted: "purple", Undone: "orange", Told: "gray" }

export const title =
  "One Delete of the chosen elements is one undo step that brings back only what went, and never an element an agent deleted"
