const steps = {
  IssuePerson: "issue a code for the person",
  IssueAgent: "issue a code for the agent",
  IssuePersonRefused: "refuse another code for the person",
  IssueAgentRefused: "refuse another code for the agent",
  UseCode: "exchange the code once",
  UseAgain: "refuse a second use of the code",
  UseEarly: "refuse a code that was not issued",
  UseRevoked: "refuse a code after revocation",
  UseOther: "refuse the code for another deck",
  Call: "call with the stored identity",
  CallOther: "refuse another deck",
  CallRefused: "refuse a call",
  Rotate: "rotate the refresh token",
  RotateRefused: "refuse a rotation",
  Reuse: "reuse the rotated refresh token",
  ReuseRefused: "refuse a reuse",
  Revoke: "revoke the family",
  RevokeRefused: "refuse a revocation",
}

export const state = (v) =>
  `code ${v.code}, access ${v.access}, refresh ${v.refresh}, previous ${v.previous}, family ${v.family}, who ${v.who}, deck ${v.deck}, called ${v.called}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.family === "revoked") return "Revoked"
  if (v.previous === "r1") return "Rotated"
  if (v.access === "live") return "Live"
  if (v.code === "open") return "Code"
  return "Start"
}

export const colors = {
  Start: "blue",
  Code: "orange",
  Live: "purple",
  Rotated: "teal",
  Revoked: "gray",
}

export const title = "Issue one code, rotate its refresh token, and revoke the family"
