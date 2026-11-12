export const state = (value) =>
  !value.added
    ? "no text box"
    : `text box ${value.removed ? "removed" : "on the slide"}, ${value.typed ? "typed in" : "empty"}`
export const step = (action) =>
  ({ Add: "add a text box", Type: "type in the text box", Remove: "remove the text box" })[action] ?? null
export const group = (value) => (!value.added ? "None" : value.removed ? "Removed" : "Shown")
export const colors = { None: "gray", Shown: "blue", Removed: "purple" }
export const title = "A removed element takes no edit and its id is never handed out again"
