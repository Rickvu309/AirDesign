import { describe, expect, it } from "vitest"
import { productionHosts, productionStandIn } from "./verify-airdesign.mjs"

describe("production stand-in", () => {
  it("catches the site, the studio and any other airdesign.app host, and nothing else", () => {
    expect(productionHosts.test("https://airdesign.app/sign-in/?next=%2F")).toBe(true)
    expect(productionHosts.test("https://studio.airdesign.app/mcp")).toBe(true)
    expect(productionHosts.test("http://127.0.0.1:4000/sign-in")).toBe(false)
    expect(productionHosts.test("https://airdesign.app.example.com/")).toBe(false)
  })

  it("names the address the app asked for without letting it write markup", () => {
    expect(productionStandIn('https://airdesign.app/sign-in?next=<x>"')).toContain(
      'data-production-url="https://airdesign.app/sign-in?next=x"',
    )
  })
})
