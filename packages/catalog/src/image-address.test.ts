import { describe, expect, it } from "vitest"
import { webImage } from "./image-address.js"
import { readSetChange } from "./set-wire.js"

describe("an image source an agent sends", () => {
  it("takes a Lucide name or an https address for fills.source and an image paint, and nothing else", () => {
    const address = "https://images.example.com/logo.png"
    expect(readSetChange({ op: "set", target: "256.2", fills: { source: address } })).toMatchObject({
      ok: true,
      change: { fills: { source: address } },
    })
    expect(readSetChange({ op: "set", target: "256.2", fills: { paint: { image: address } } })).toMatchObject({
      ok: true,
      change: { fills: { paint: { image: address } } },
    })
    expect(readSetChange({ op: "set", target: "256.2", fills: { source: "http://images.example.com/a.png" } }).ok).toBe(
      false,
    )
    expect(readSetChange({ op: "set", target: "256.2", fills: { source: "rocket" } }).ok).toBe(true)
  })

  it("names an https address of at most 2048 characters with no spaces a web image", () => {
    expect(webImage("https://images.example.com/logo.png")).toBe(true)
    expect(webImage("https://images.example.com/a logo.png")).toBe(false)
    expect(webImage(`https://images.example.com/${"a".repeat(2048)}`)).toBe(false)
    expect(webImage("rocket")).toBe(false)
  })
})
