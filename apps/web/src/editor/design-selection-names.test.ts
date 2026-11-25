import { expect, it } from "vitest"
import { colorNameCopy } from "@/copy/color-name-copy"
import { namedColorRows } from "./design-selection-names"
import { greys } from "./testing/design-selection-names-art"

const hexOf = (css: string) => css.slice(1).toUpperCase()
const templateColors = [{ var: "text2", css: greys.theme, name: colorNameCopy.grey }] as const

it("names an off-palette colour the same way on any selection and never reuses a theme colour's name", () => {
  const rows = namedColorRows(
    [
      { hex: hexOf(greys.theme), color: { var: "text2" } },
      { hex: hexOf(greys.raw), color: greys.raw },
      { hex: hexOf(greys.light), color: greys.light },
    ],
    templateColors,
  )
  expect(rows.map(({ name }) => name)).toEqual([
    colorNameCopy.grey,
    colorNameCopy.numbered(colorNameCopy.grey, 2),
    colorNameCopy.lightGrey,
  ])
})
