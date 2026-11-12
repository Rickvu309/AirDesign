import { describe, expect, it } from "vitest"

import { accountPaths, accountRoutes, readGrantId } from "./index.js"

describe("account agent routes and grant id reader", () => {
  it("lists both connected-agent paths under accountRoutes", () => {
    expect(accountRoutes.agents).toEqual({ path: "/account/agents", method: "POST" })
    expect(accountRoutes.revokeAgent).toEqual({ path: "/account/agents/revoke", method: "POST" })
    expect(accountPaths).toContain("/account/agents")
    expect(accountPaths).toContain("/account/agents/revoke")
  })

  it("accepts a storable grant id between 1 and 128 characters", () => {
    expect(readGrantId({ id: "g" })).toEqual({ ok: true, id: "g" })
    expect(readGrantId({ id: "a".repeat(128) })).toEqual({ ok: true, id: "a".repeat(128) })
  })

  it("refuses missing, extra, empty, oversized, or unstorable grant ids", () => {
    expect(readGrantId(null)).toEqual({ ok: false, refusal: "field" })
    expect(readGrantId([])).toEqual({ ok: false, refusal: "field" })
    expect(readGrantId({})).toEqual({ ok: false, refusal: "field" })
    expect(readGrantId({ id: "" })).toEqual({ ok: false, refusal: "field" })
    expect(readGrantId({ id: 42 })).toEqual({ ok: false, refusal: "field" })
    expect(readGrantId({ id: "g", extra: true })).toEqual({ ok: false, refusal: "field" })
    expect(readGrantId({ id: "a".repeat(129) })).toEqual({ ok: false, refusal: "field" })
    expect(readGrantId({ id: "bad\u0000id" })).toEqual({ ok: false, refusal: "field" })
    expect(readGrantId({ id: "\ud800" })).toEqual({ ok: false, refusal: "field" })
  })
})
