import { oauth, type Command as OauthCommand, type Grant } from "@airdesign/oauth"

type Spec = Record<string, boolean | number | string>
type Graph = { states: Map<string, Spec>; edges: { from: string; to: string; action: string }[] }

function num(spec: Spec, key: string): number {
  const value = spec[key]
  if (typeof value !== "number") throw new Error(`${key} is not a number`)
  return value
}

function flag(spec: Spec, key: string): boolean {
  const value = spec[key]
  if (typeof value !== "boolean") throw new Error(`${key} is not a boolean`)
  return value
}

function text(spec: Spec, key: string): string {
  const value = spec[key]
  if (typeof value !== "string") throw new Error(`${key} is not text`)
  return value
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function oauthGrant(spec: Spec): Grant {
  const code = text(spec, "code")
  if (code !== "open" && code !== "used") throw new Error(`bad oauth code ${code}`)
  return {
    principal: text(spec, "principal"),
    code,
    generation: num(spec, "generation"),
    revoked: flag(spec, "revoked"),
  }
}

function oauthPicture(grant: Grant) {
  return {
    principal: grant.principal,
    code: grant.code,
    generation: grant.generation,
    revoked: grant.revoked,
  }
}

function oauthEdge(action: string): { command: OauthCommand; accepted: boolean } | null {
  const call = (generation: number, accepted: boolean) => ({
    command: { command: "call" as const, generation },
    accepted,
  })
  const rotate = (generation: number, accepted: boolean) => ({
    command: { command: "rotate" as const, generation },
    accepted,
  })
  if (action === "Exchange") return { command: { command: "exchange" }, accepted: true }
  if (action === "ExchangeRefused") return { command: { command: "exchange" }, accepted: false }
  if (action === "Call0Refused") return call(0, false)
  if (action === "Call1") return call(1, true)
  if (action === "Call1Refused") return call(1, false)
  if (action === "Call2") return call(2, true)
  if (action === "Call2Refused") return call(2, false)
  if (action === "Call3") return call(3, true)
  if (action === "Call3Refused") return call(3, false)
  if (action === "Rotate0") return rotate(0, false)
  if (action === "Rotate1") return rotate(1, true)
  if (action === "Rotate1Reuse") return rotate(1, false)
  if (action === "Rotate1Refused") return rotate(1, false)
  if (action === "Rotate2") return rotate(2, true)
  if (action === "Rotate2Reuse") return rotate(2, false)
  if (action === "Rotate2Refused") return rotate(2, false)
  if (action === "Rotate3Refused") return rotate(3, false)
  if (action === "Rotate4") return rotate(4, false)
  if (action === "Revoke") return { command: { command: "revoke" }, accepted: true }
  if (action === "RevokeAgain") return { command: { command: "revoke" }, accepted: false }
  return null
}

export function replayOauth(
  graph: Graph,
  where: (source: Spec, target: Spec, action: string) => string,
  failures: string[],
) {
  let replayed = 0
  let stuttered = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing oauth state for ${edge.action}`)
    const step = oauthEdge(edge.action)
    if (!step) {
      failures.push(`oauth ${where(source, target, edge.action)} is not connected`)
      continue
    }
    const result = oauth(oauthGrant(source), step.command)
    const actual = oauthPicture(result.grant)
    const expected = oauthPicture(oauthGrant(target))
    if (!same(actual, expected)) {
      failures.push(
        `oauth ${where(source, target, edge.action)}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`,
      )
      continue
    }
    if (result.accepted !== step.accepted) {
      failures.push(`oauth ${where(source, target, edge.action)} accepted ${String(result.accepted)}`)
      continue
    }
    const changed = !same(oauthPicture(oauthGrant(source)), expected)
    if (changed || result.accepted) replayed += 1
    else stuttered += 1
  }
  return { replayed, stuttered }
}
