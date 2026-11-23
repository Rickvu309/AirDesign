import { describe, expect, it } from "vitest"
import { composing } from "./composing"

const key = (init: { isComposing?: boolean; keyCode?: number }) => ({
  isComposing: init.isComposing ?? false,
  keyCode: init.keyCode ?? 13,
})

describe("composing", () => {
  it("is true while an IME marks the key as part of its composition", () => {
    expect(composing(key({ isComposing: true }) as KeyboardEvent)).toBe(true)
  })

  it("is true for Safari's commit key, which carries keyCode 229 without isComposing", () => {
    expect(composing(key({ keyCode: 229 }) as KeyboardEvent)).toBe(true)
  })

  it("is true for a React event whose native event composes", () => {
    expect(composing({ nativeEvent: key({ isComposing: true }) } as unknown as KeyboardEvent)).toBe(true)
  })

  it("is false for a plain Enter", () => {
    expect(composing(key({}) as KeyboardEvent)).toBe(false)
  })
})
