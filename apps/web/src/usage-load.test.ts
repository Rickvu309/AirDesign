import { airaRoutes } from "@airdesign/catalog"
import { describe, expect, it } from "vitest"
import { loadUsage } from "./usage-load"

const usage = { used: 0.76, allowed: 2, resets: "2026-11-16T00:00:00.000Z" }

function answering(status: number, body: unknown, seen: Request[] = []): typeof fetch {
  return async (input, init) => {
    seen.push(new Request(new URL(String(input), "https://studio.example"), init))
    return Response.json(body, { status })
  }
}

describe("loading the week's usage", () => {
  it("posts an empty body to the usage route and reads the account and the week", async () => {
    const seen: Request[] = []
    const loaded = await loadUsage(answering(200, { ok: true, account: { email: "ada@example.com" }, usage }, seen))
    expect(loaded).toEqual({ kind: "usage", email: "ada@example.com", usage })
    expect(seen.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
      [airaRoutes.usage.method, airaRoutes.usage.path],
    ])
    expect(await seen[0]?.json()).toEqual({})
  })

  it("says signed out on a session refusal, and unavailable on any other answer or a dropped connection", async () => {
    expect(await loadUsage(answering(401, { ok: false, refusal: "session" }))).toEqual({ kind: "signed-out" })
    expect(await loadUsage(answering(500, { ok: false, refusal: "server" }))).toEqual({ kind: "unavailable" })
    expect(await loadUsage(answering(200, { ok: true, account: { email: "a@b.co" }, usage: { used: "x" } }))).toEqual({
      kind: "unavailable",
    })
    const dropped: typeof fetch = async () => {
      throw new TypeError("network")
    }
    expect(await loadUsage(dropped)).toEqual({ kind: "unavailable" })
  })
})
