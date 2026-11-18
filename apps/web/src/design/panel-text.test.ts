import { elementId, writeTextValue, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf } from "./panel"

const shape: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: true, grouped: false, animated: false },
  kept: [],
  value: "Hello",
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

it("keeps Weight and Bold in agreement, supports Mixed, and writes named static faces", () => {
  const controls = (value: string) =>
    panelOf({ ...shape, value }, { reads: {}, moves: true })
      .sections.find((section) => section.trait === "text")
      ?.strips.flat() ?? []
  const regular = controls(writeTextValue([{ from: 0, runs: [{ from: 0, text: "A", font: "Lato", bold: false }] }]))
  const weight = regular.find((control) => control.field === "weight")
  expect(weight?.value).toBe("regular")
  expect(weight?.change("bold").text).toEqual({ bold: true })
  expect(weight?.change("Lato Light").text).toEqual({ font: "Lato Light" })
  const mixed = controls(
    writeTextValue([
      {
        from: 0,
        runs: [
          { from: 0, text: "A", bold: true },
          { from: 1, text: "B", bold: false },
        ],
      },
    ]),
  )
  expect(mixed.find((control) => control.field === "weight")?.mixed).toBe(true)
})

it("shows a template font's family while retaining its native token and matching style", () => {
  const panel = panelOf(
    {
      ...shape,
      value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title", font: "+mj-lt" }] }]),
      textStyles: [{ id: "title", name: "Title", fields: { font: "+mj-lt" } }],
    },
    { fonts: { major: "Lato" }, reads: {}, moves: true },
  )
  const controls = panel.sections.find((section) => section.trait === "text")?.strips.flat() ?? []
  expect(controls.find((control) => control.field === "font")?.value).toBe("Lato")
  expect(controls.find((control) => control.field === "style")?.value).toBe("title")
  expect(
    controls.find((control) => control.field === "weight")?.choices?.some((choice) => choice.value === "Lato Light"),
  ).toBe(true)
})

it("routes a text box's Fill to its letters and keeps its box fill folded", () => {
  const panel = panelOf(shape, { reads: {}, moves: true })
  const fill = panel.sections.find((section) => section.trait === "textFill")?.strips.flat()[0]
  expect(fill?.desc).toMatchObject({ kind: "union", cases: { solid: { kind: "color" }, gradient: { kind: "record" } } })
  expect(fill?.change({ solid: { scheme: "accent1" } })).toEqual({
    target: { node: shape.node },
    text: { fill: { solid: { scheme: "accent1" } } },
  })
  expect(panel.sections.find((section) => section.trait === "boxFill")).toMatchObject({ open: false })
  expect(
    panel.sections
      .find((section) => section.trait === "text")
      ?.strips.flat()
      .some((control) => control.field === "fill" || control.field === "color"),
  ).toBe(false)
})
