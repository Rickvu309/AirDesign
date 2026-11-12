const steps = {
  ReserveHalf: "reserve half the allowance",
  ReserveAll: "reserve the whole allowance",
  ReserveZero: "reserve nothing",
  ReserveHalfRefused: "refuse a half reserve",
  ReserveAllRefused: "refuse a whole reserve",
  ReserveSearch: "reserve half plus one search",
  ReserveSearchRefused: "refuse a search reserve",
  ReserveUs: "reserve half at the US-only rate",
  ReserveUsRefused: "refuse a US-only reserve",
  SettleHalf: "settle a half charge",
  SettleAll: "settle the whole allowance",
  SettleAgain: "settle the same turn again",
  SettleOther: "settle another turn",
  SettleSearch: "settle half plus one search",
  SettleUs: "settle half at the US-only rate",
  StopHalf: "stop the open turn after half the allowance",
  StopAll: "stop the open turn after the whole allowance, charged at most its reserve",
  StopAgain: "stop the same turn again",
  StopOther: "stop another turn",
  Release: "release the open turn",
  ReleaseOther: "release another turn",
  ReleaseClosed: "release when nothing is open",
  Monday: "reset the week",
  Outside: "count one outside write",
}

export const state = (v) => {
  const turn = v.turn === "none" ? "no open turn" : "turn a open"
  return `spent ${v.spent}, hold ${v.hold}, ${turn}, week ${v.week}, outside ${v.outside}`
}

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.turn !== "none") return "Held"
  if (v.week === 1) return "Reset"
  if (v.spent !== 0) return "Spent"
  if (v.outside === 1) return "Outside"
  return "Open"
}

export const colors = {
  Open: "blue",
  Held: "orange",
  Spent: "purple",
  Outside: "teal",
  Reset: "gray",
}

export const title = "Spend a weekly allowance and reset it on Monday"
