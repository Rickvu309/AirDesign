import fc from "fast-check"
import { expect, it } from "vitest"
import {
  readTextValue,
  writeTextValue,
  alignNames,
  schemeNames,
  type RunColor,
  type TextParagraph,
  type TextRun,
  type TextValue,
} from "./text-value.js"

const text = fc.oneof(
  fc.string({ unit: "binary", maxLength: 24 }),
  fc.constantFrom('"', "\\", "\n", "🙂", "\uD800", ""),
)

function kept<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}

function textValue(): fc.Arbitrary<TextValue> {
  const color: fc.Arbitrary<RunColor | undefined> = fc.option(
    fc.oneof(
      fc.constantFrom(...schemeNames).map((scheme) => ({ scheme }) as RunColor),
      fc.stringMatching(/^[0-9A-F]{6}$/).map((rgb) => ({ rgb }) as RunColor),
    ),
    { nil: undefined },
  )
  const run = fc
    .record({
      from: fc.integer({ min: -1, max: 32 }),
      text,
      bold: fc.option(fc.boolean(), { nil: undefined }),
      italic: fc.option(fc.boolean(), { nil: undefined }),
      underline: fc.option(fc.boolean(), { nil: undefined }),
      size: fc.option(fc.integer({ min: 100, max: 400_000 }), { nil: undefined }),
      color,
    })
    .map((value) => kept(value) as TextRun)
  const paragraph = fc
    .record({
      from: fc.integer({ min: 0, max: 32 }),
      align: fc.option(fc.constantFrom(...alignNames), { nil: undefined }),
      bullet: fc.option(fc.boolean(), { nil: undefined }),
      runs: fc.array(run, { maxLength: 4 }),
    })
    .map((value) => kept(value) as TextParagraph)
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
