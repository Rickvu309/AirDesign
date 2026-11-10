const steps = {
  ExchangeHome: "exchange the code for its deck",
  ExchangeHomeRefused: "refuse the code",
  ExchangeOther: "exchange the code for the other deck",
  ExchangeOtherRefused: "refuse the code for the other deck",
  CallHome0Refused: "refuse generation 0 on home",
  CallOther0Refused: "refuse generation 0 on the other deck",
  CallHome1: "call generation 1 on its deck",
  CallHome1Refused: "refuse generation 1 on home",
  CallHome2: "call generation 2 on its deck",
  CallHome2Refused: "refuse generation 2 on home",
  CallHome3: "call generation 3 on its deck",
  CallHome3Refused: "refuse generation 3 on home",
  CallOther1: "call generation 1 on the other deck",
  CallOther1Refused: "refuse generation 1 on the other deck",
  CallOther2: "call generation 2 on the other deck",
  CallOther2Refused: "refuse generation 2 on the other deck",
  CallOther3: "call generation 3 on the other deck",
  CallOther3Refused: "refuse generation 3 on the other deck",
  Rotate0: "refuse generation 0",
  Rotate1: "rotate generation 1",
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
  return `${v.principal} ${v.deck} code ${v.code} generation ${v.generation} ${revoked} ${reused} exchanges ${v.exchanges} call ${v.callNamed} at ${v.callAt} on ${v.callDeck} rotate ${v.rotateNamed} at ${v.rotateAt} exchange ${v.exchangeDeck} ${after}`
}

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.revoked === true) return "Revoked"
  if (v.generation >= 2) return "Rotated"
  if (v.code === "used") return "Live"
  return "Open"
}

export const colors = {
  Open: "blue",
  Live: "purple",
  Rotated: "teal",
  Revoked: "gray",
}

export const title = "Exchange one code, rotate its refresh token, and revoke the family"
