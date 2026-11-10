export type Grant = {
  readonly code: "none" | "open" | "used"
  readonly access: "none" | "live" | "dead"
  readonly refresh: "none" | "r1" | "r2" | "dead"
  readonly previous: "none" | "r1"
  readonly family: "open" | "revoked"
  readonly who: "none" | "person" | "agent"
  readonly deck: "none" | "home"
  readonly called: "no" | "yes"
}

export type Command =
  | { readonly command: "person" }
  | { readonly command: "agent" }
  | { readonly command: "exchange"; readonly deck: "home" | "other" }
  | { readonly command: "call"; readonly deck: "home" | "other" }
  | { readonly command: "rotate" }
  | { readonly command: "reuse" }
  | { readonly command: "revoke" }

export type OauthResult = {
  readonly grant: Grant
  readonly accepted: boolean
}

export function openGrant(): Grant {
  return {
    code: "none",
    access: "none",
    refresh: "none",
    previous: "none",
    family: "open",
    who: "none",
    deck: "none",
    called: "no",
  }
}

function refused(grant: Grant): OauthResult {
  return { grant, accepted: false }
}

function accepted(grant: Grant): OauthResult {
  return { grant, accepted: true }
}

function killed(grant: Grant): Grant {
  return {
    ...grant,
    family: "revoked",
    access: grant.access === "none" ? "none" : "dead",
    refresh: grant.refresh === "none" ? "none" : "dead",
  }
}

export function oauth(grant: Grant, command: Command): OauthResult {
  if (command.command === "person" || command.command === "agent") {
    if (grant.code !== "none" || grant.who !== "none") return refused(grant)
    return accepted({ ...grant, code: "open", who: command.command, deck: "home" })
  }
  if (command.command === "exchange") {
    if (command.deck !== grant.deck || grant.code !== "open" || grant.family !== "open") return refused(grant)
    return accepted({ ...grant, code: "used", access: "live", refresh: "r1" })
  }
  if (command.command === "call") {
    if (command.deck !== grant.deck || grant.access !== "live" || grant.family !== "open") return refused(grant)
    if (grant.called === "yes") return accepted(grant)
    return accepted({ ...grant, called: "yes" })
  }
  if (command.command === "rotate") {
    if (grant.refresh !== "r1" || grant.family !== "open" || grant.previous !== "none") return refused(grant)
    return accepted({ ...grant, refresh: "r2", previous: "r1", called: "no" })
  }
  if (command.command === "reuse") {
    if (grant.previous !== "r1" || grant.family !== "open") return refused(grant)
    return accepted(killed(grant))
  }
  if (grant.family !== "open" || grant.code === "none") return refused(grant)
  return accepted(killed(grant))
}
