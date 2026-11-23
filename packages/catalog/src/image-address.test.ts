import { describe, expect, it } from "vitest"
import { webImage } from "./image-address.js"

describe("an image source an agent sends", () => {
  it("names an https address of at most 2048 characters with no spaces a web image", () => {
    expect(webImage("https://images.example.com/logo.png")).toBe(true)
    expect(webImage("https://images.example.com/a logo.png")).toBe(false)
    expect(webImage(`https://images.example.com/${"a".repeat(2048)}`)).toBe(false)
    expect(webImage("rocket")).toBe(false)
  })
})
