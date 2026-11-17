const names = [
  "Opening",
  "Head deleted",
  "Foreign slide inserted",
  "Head restore refused",
  "Singleton deleted",
  "Singleton restored",
  "Head moved",
  "Move undone",
  "Slide added",
  "Slide duplicated",
  "Add undone",
  "Duplicate undone",
  "Nonhead deleted",
  "Safe gap insert",
  "Nonhead restored",
]
export const state = (v) => names[v.stage] + ", device at " + names[v.cacheStage]
export const step = (action) => (action === "Adopt" ? "the device adopts the accepted prefix" : action)
export const group = (v) => (v.stage === v.cacheStage ? "Same prefix" : "Device behind")
export const colors = { "Same prefix": "teal", "Device behind": "orange" }
export const title = "Slide edits preserve the grid partition and adoption agrees"
