import fc from "fast-check"
import { expect, it } from "vitest"
import { mappedSlots, templateColors, type Color, type ColorTransform } from "./color.js"
import {
  readTextValue,
  writeTextValue,
  alignNames,
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
  const hex = fc.stringMatching(/^[0-9A-F]{6}$/)
  const base = fc.oneof(
    fc.constantFrom(...templateColors, ...mappedSlots).map((scheme) => ({ scheme })),
    hex.map((rgb) => ({ rgb })),
    hex.map((last) => ({ system: "windowText", last })),
    fc.constantFrom("black", "dkSlateBlue").map((preset) => ({ preset })),
  )
  const transform: fc.Arbitrary<ColorTransform> = fc.oneof(
    fc
      .constantFrom("lumMod", "lumOff", "satMod", "hueOff", "redOff")
      .chain((op) => fc.integer({ min: -200_000, max: 200_000 }).map((val) => ({ op, val }))),
    fc
      .constantFrom("alpha", "tint", "shade")
      .chain((op) => fc.integer({ min: 0, max: 100_000 }).map((val) => ({ op, val }))),
    fc.constantFrom("comp", "inv", "gray", "gamma", "invGamma").map((op) => ({ op })),
  )
  const color: fc.Arbitrary<Color | undefined> = fc.option(
    fc
      .tuple(base, fc.array(transform, { maxLength: 4 }))
      .map(([read, transforms]) => (transforms.length === 0 ? read : { ...read, transforms })),
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
      list: fc.option(fc.constantFrom("none", "bullets", "numbers"), { nil: undefined }),
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
