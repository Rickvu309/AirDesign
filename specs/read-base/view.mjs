const steps = {
  CheckEmpty: "accept an empty guarded edit without advancing the head",
  PrepareFirst: "prepare the first edit while offline",
  PrepareSecond: "prepare a second edit on the first",
  Other: "another writer advances the deck",
  AcceptFirst: "save the first edit at its exact base",
  LoseReply: "save the first edit and lose its reply",
  Retry: "retry the first once and read its original answer",
  RefuseFirst: "refuse the stale first edit and its dependent",
  LoseCAS: "another writer wins the compare-and-swap",
  AcceptSecond: "save the second edit at the consecutive head",
  RefuseSecond: "refuse the second edit after the head moves",
}

export const title = "Guard an edit's read base"
export const group = (v) => (v.other ? "Interleaved" : "Consecutive")
export const state = (v) =>
  `deck at ${v.head}, tab knows ${v.known}, first ${v.first} at ${v.aAt}, second ${v.second} at ${v.bAt}`
export const step = (action) => steps[action] ?? null
export const colors = { Interleaved: "orange", Consecutive: "blue" }
