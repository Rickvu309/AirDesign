import { describe, expect, it } from "vitest"
import { accountName } from "./account-name"

describe("account name", () => {
  it("reads a person's name from the words before the at sign", () => {
    expect(accountName("quan.vu@example.com")).toBe("Quan Vu")
    expect(accountName("minh_quan-vu@example.com")).toBe("Minh Quan Vu")
  })

  it("drops a plus tag and the digits that end a word", () => {
    expect(accountName("cao.phan7+decks@example.com")).toBe("Cao Phan")
  })

  it("keeps the casing a person typed past the first letter", () => {
    expect(accountName("McKay@example.com")).toBe("McKay")
  })

  it("falls back to the email when no word is left", () => {
    expect(accountName("2024@example.com")).toBe("2024@example.com")
    expect(accountName("")).toBe("")
  })
})
