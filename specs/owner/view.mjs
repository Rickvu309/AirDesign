const steps = {
  Register: "register a client",
  Approve: "approve the client for the account",
  Exchange: "exchange the code",
  ExchangeAgain: "exchange a used code and revoke the grant",
  Rotate: "rotate the refresh token",
  ReplayRotated: "replay a rotated refresh token and revoke the grant",
  Revoke: "revoke the grant",
  CookieCall: "call a tool with a session cookie",
  TokenCall: "call a tool with an access token",
  TokenRefused: "refuse an access token that is not live",
  RefreshAsBearer: "refuse a refresh token sent as a bearer",
}

const grant = (code, generation, revoked) => `${code} ${generation} ${revoked === true ? "revoked" : "live"}`

export const state = (v) =>
  `a ${grant(v.codeA, v.generationA, v.revokedA)}, b ${grant(v.codeB, v.generationB, v.revokedB)}, call by ${v.callHolder} claiming ${v.callClaim} as ${v.callAccount} on ${v.callDeck} ${v.callOutcome}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.callOutcome === "landed") return "Landed"
  if (v.callOutcome === "none") return "Quiet"
  return "Refused"
}

export const colors = {
  Quiet: "blue",
  Landed: "teal",
  Refused: "gray",
}

export const title = "Only a deck's owner can act on it through a tool call, whatever account the caller claims"
