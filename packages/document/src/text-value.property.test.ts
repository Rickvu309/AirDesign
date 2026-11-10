import fc from "fast-check"
import { expect, it } from "vitest"
import { readTextValue, writeTextValue, type TextValue } from "./text-value.js"

const text = fc.oneof(
  fc.string({ unit: "binary", maxLength: 24 }),
  fc.constantFrom('"', "\\", "\n", "🙂", "\uD800", ""),
)

function textValue(): fc.Arbitrary<TextValue> {
  const run = fc.record({
    from: fc.integer({ min: -1, max: 32 }),
    text,
  })
  const paragraph = fc.record({
    from: fc.integer({ min: 0, max: 32 }),
    runs: fc.array(run, { maxLength: 4 }),
  })
  return fc.array(paragraph, { minLength: 1, maxLength: 4 })
}

it("reads the text value it wrote", () => {
  fc.assert(
    fc.property(textValue(), (value) => {
      expect(readTextValue(writeTextValue(value))).toEqual(value)
    }),
  )
})

it("writes the same string it already wrote", () => {
  fc.assert(
    fc.property(textValue(), (value) => {
      const written = writeTextValue(value)
      const read = readTextValue(written)
      expect(read === null ? null : writeTextValue(read)).toBe(written)
    }),
  )
})
