import { accountRoutes } from "@airdesign/catalog"
import { describe, expect, it } from "vitest"
import { loadAccount } from "./account-load"

function answering(status: number, body: unknown, seen: Request[] = []): typeof fetch {
  return async (input, init) => {
    seen.push(new Request(new URL(String(input), "https://studio.example"), init))
    return Response.json(body, { status })
  }
}

describe("loading the signed-in account", () => {
  it("posts an empty body to the connected agents route and reads the account email", async () => {
    const seen: Request[] = []
    const loaded = await loadAccount(answering(200, { ok: true, account: { email: "ada@example.com" } }, seen))
    expect(loaded).toEqual({ kind: "account", email: "ada@example.com" })
    expect(seen.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
      ["POST", accountRoutes.agents.path],
    ])
    expect(await seen[0]?.json()).toEqual({})
  })

  it("says signed out on a session refusal, and unavailable on any other answer or a dropped connection", async () => {
    expect(await loadAccount(answering(401, { ok: false, refusal: "session" }))).toEqual({ kind: "signed-out" })
    expect(await loadAccount(answering(500, { ok: false, refusal: "server" }))).toEqual({ kind: "unavailable" })
    expect(await loadAccount(answering(200, { ok: true, account: {} }))).toEqual({ kind: "unavailable" })
    const dropped: typeof fetch = async () => {
      throw new TypeError("network")
    }
    expect(await loadAccount(dropped)).toEqual({ kind: "unavailable" })
  })
})
