import { describe, expect, it } from "vitest"
import { bytesOf, limits } from "@airdesign/doom"

describe("limits", () => {
  it("keeps the product caps unchanged", () => {
    expect(limits.body).toBe(1_000_000)
    expect(limits.form).toBe(16_384)
    expect(limits.batch).toBe(100)
    expect(limits.notify).toBe(8_000)
    expect(limits.name).toBe(200)
    expect(limits.delete).toBe(100)
    expect(limits.clientName).toBe(200)
    expect(limits.address).toBe(2_000)
    expect(limits.row).toBe(65_536)
  })
})

describe("bytesOf", () => {
  it("counts an ASCII string", () => {
    expect(bytesOf("hello")).toBe(5)
  })

  it("counts a 2-byte character", () => {
    expect(bytesOf("é")).toBe(2)
  })

  it("counts a 3-byte character", () => {
    expect(bytesOf("€")).toBe(3)
  })

  it("counts a 4-byte character", () => {
    expect(bytesOf("😀")).toBe(4)
  })

  it("counts a lone high surrogate", () => {
    expect(bytesOf("\ud800")).toBe(3)
  })

  it("counts a lone low surrogate", () => {
    expect(bytesOf("\udfff")).toBe(3)
  })

  it("counts the empty string", () => {
    expect(bytesOf("")).toBe(0)
  })
})
