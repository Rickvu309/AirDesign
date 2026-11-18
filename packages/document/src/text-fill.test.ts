import { expect, it } from "vitest"
import { readTextValue, writeTextValue } from "./text-value.js"

it("keeps a gradient as one text fill choice", () => {
  const fill = {
    gradient: {
      stops: [
        { pos: 0, color: { rgb: "FF0000" } },
        { pos: 100000, color: { rgb: "0000FF" } },
      ],
      shade: { linear: { angle: 0, scaled: true } },
      rotateWithShape: true,
    },
  }
  const value = [{ from: 0, runs: [{ from: 0, text: "Gradient", fill }] }]
  expect(readTextValue(JSON.stringify(value))).toEqual(value)
  expect(readTextValue(writeTextValue(value))).toEqual(value)
})

it("refuses two competing text paints", () => {
  expect(
    readTextValue(
      JSON.stringify([
        { from: 0, runs: [{ from: 0, text: "A", color: { rgb: "FFFFFF" }, fill: { solid: { rgb: "000000" } } }] },
      ]),
    ),
  ).toBeNull()
})
