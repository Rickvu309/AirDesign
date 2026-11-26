export type Grant = {
  readonly principal: string
  readonly code: "open" | "used"
  readonly generation: number
  readonly revoked: boolean
  readonly rotates: boolean
}

export type Command =
  | { readonly command: "exchange"; readonly rotates: boolean }
  | { readonly command: "call"; readonly generation: number }
  | { readonly command: "rotate"; readonly generation: number }
  | { readonly command: "revoke" }

type OauthResult = {
  readonly grant: Grant
  readonly accepted: boolean
}

export function openGrant(principal: string): Grant {
  return { principal, code: "open", generation: 0, revoked: false, rotates: true }
}

function refused(grant: Grant): OauthResult {
  return { grant, accepted: false }
}

function accepted(grant: Grant): OauthResult {
  return { grant, accepted: true }
}

export function oauth(grant: Grant, command: Command): OauthResult {
  if (typeof command !== "object" || command === null) return refused(grant)
  if (command.command === "exchange") {
    if (grant.code === "used" || grant.revoked || typeof command.rotates !== "boolean") return refused(grant)
    return accepted({ ...grant, code: "used", generation: 1, rotates: command.rotates })
  }
  if (command.command === "call") {
    if (grant.revoked || grant.generation < 1 || command.generation !== grant.generation) return refused(grant)
    return accepted(grant)
  }
  if (command.command === "rotate") {
    if (grant.revoked || !Number.isInteger(command.generation)) return refused(grant)
    if (command.generation >= 1 && command.generation === grant.generation) {
      return accepted(grant.rotates ? { ...grant, generation: grant.generation + 1 } : grant)
    }
    if (command.generation >= 1 && command.generation < grant.generation) {
      return { grant: { ...grant, revoked: true }, accepted: false }
    }
    return refused(grant)
  }
  if (command.command === "revoke") {
    if (grant.revoked) return refused(grant)
    return accepted({ ...grant, revoked: true })
  }
  return refused(grant)
}
