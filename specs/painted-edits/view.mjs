export const title = "Export waits for edits that painted and edits on a new layer wait for its insert"

export const state = ({ mode, painted, stored, requested, copied }) =>
  `${mode}: painted ${painted}, stored ${stored}, export requests ${requested}, ${copied >= 0 ? "exported" : "waiting"}`

export const step = (action) => action

export const group = ({ painted, stored }) => (painted === stored ? "Stored" : "Painted ahead")
