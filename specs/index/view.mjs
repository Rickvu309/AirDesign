export const state = (value) => `${value.stored} import pages stored; revision ${value.revision}`
export const step = (action) => (action === "Store" ? "store or replay an import page without making an edit" : null)
export const group = (value) => (value.stored === 2 ? "Ready" : value.queued === 0 ? "Missing" : "Pending")
export const colors = { Ready: "green", Missing: "gray", Pending: "orange" }
export const title = "Import pages are not edits"
