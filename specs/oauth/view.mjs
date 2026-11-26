const steps = {
  Exchange: "exchange the code",
  ExchangeKept: "exchange the code for a refresh token that stays",
  ExchangeRefused: "refuse the code",
  Call0Refused: "refuse generation 0",
  Call1: "call generation 1",
  Call1Refused: "refuse generation 1",
  Call2: "call generation 2",
  Call2Refused: "refuse generation 2",
  Call3: "call generation 3",
  Call3Refused: "refuse generation 3",
  Rotate0: "refuse generation 0",
  Rotate1: "rotate generation 1",
  Rotate1Kept: "refresh generation 1 and keep its refresh token",
  Rotate1Reuse: "reuse generation 1",
  Rotate1Refused: "refuse generation 1",
  Rotate2: "rotate generation 2",
  Rotate2Reuse: "reuse generation 2",
  Rotate2Refused: "refuse generation 2",
  Rotate3Refused: "refuse generation 3 when it is not current",
  Rotate4: "refuse a generation above the model",
  Revoke: "revoke the family",
  RevokeAgain: "refuse a second revocation",
}

export const state = (v) => {
  const revoked = v.revoked === true ? "revoked" : "live"
  const reused = v.reused === true ? "reused" : "fresh"
  const after = v.acceptedAfter === true ? "accepted-after" : "quiet"
  const rotates = v.rotates === false ? "keeps" : "rotates"
  return `${v.principal} code ${v.code} generation ${v.generation} ${rotates} ${revoked} ${reused} exchanges ${v.exchanges} call ${v.callNamed} at ${v.callAt} rotate ${v.rotateNamed} at ${v.rotateAt} ${after}`
}

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.revoked === true) return "Revoked"
  if (v.code === "used" && v.rotates === false) return "Kept"
  if (v.generation >= 2) return "Rotated"
  if (v.code === "used") return "Live"
  return "Open"
}

export const colors = {
  Open: "blue",
  Live: "purple",
  Rotated: "teal",
  Kept: "green",
  Revoked: "gray",
}

export const title = "Exchange one code, rotate or keep its refresh token, and revoke the family"
