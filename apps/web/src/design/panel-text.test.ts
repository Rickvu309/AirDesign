import { elementId, writeTextValue, type ScopedElement, type TextRun } from "@airdesign/document"
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
  expect(weight?.value).toBe("Regular")
  expect(weight?.change("Bold").text).toEqual({ bold: true })
  expect(weight?.change("Light").text).toEqual({ font: "Lato Light" })
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

it("lists every weight and italic the family's served files hold and writes each as its named face", () => {
  const served = {
    inter: [
      { style: "normal", weight: "100 900" },
      { style: "italic", weight: "100 900" },
    ],
  }
  const controls = (runs: readonly TextRun[]) =>
    panelOf(
      { ...shape, value: writeTextValue([{ from: 0, runs }]) },
      { reads: {}, moves: true, faces: (family) => served[family.toLowerCase() as "inter"] },
    )
      .sections.find((section) => section.trait === "text")
      ?.strips.flat() ?? []
  const semibold = controls([{ from: 0, text: "A", font: "Inter SemiBold" }])
  const weight = semibold.find((control) => control.field === "weight")
  expect(weight?.choices?.map((choice) => choice.label)).toEqual([
    "Thin",
    "Thin Italic",
    "ExtraLight",
    "ExtraLight Italic",
    "Light",
    "Light Italic",
    "Regular",
    "Italic",
    "Medium",
    "Medium Italic",
    "SemiBold",
    "SemiBold Italic",
    "Bold",
    "Bold Italic",
    "ExtraBold",
    "ExtraBold Italic",
    "Black",
    "Black Italic",
  ])
  expect(weight?.value).toBe("SemiBold")
  expect(semibold.find((control) => control.field === "font")?.value).toBe("Inter")
  expect(weight?.change("Black Italic").text).toEqual({ font: "Inter Black", italic: true })
  expect(weight?.change("Bold").text).toEqual({ font: "Inter", bold: true })
  expect(weight?.change("Italic").text).toEqual({ font: "Inter", italic: true })
  expect(semibold.find((control) => control.field === "bold")?.change(true).text).toEqual({ font: "Inter", bold: true })
  const italic = controls([{ from: 0, text: "A", font: "Inter Light", italic: true }])
  expect(italic.find((control) => control.field === "weight")?.value).toBe("Light Italic")
})

it("offers Regular and Bold with their italics for a family our server does not name, before its faces load", () => {
  const controls = (font: string, faces?: (family: string) => undefined) =>
    panelOf(
      { ...shape, value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "A", font }] }]) },
      { reads: {}, moves: true, ...(faces === undefined ? {} : { faces }) },
    )
      .sections.find((section) => section.trait === "text")
      ?.strips.flat()
      .find((control) => control.field === "weight")
      ?.choices?.map((choice) => choice.label)
  expect(controls("Arial")).toEqual(["Regular", "Italic", "Bold", "Bold Italic"])
  expect(controls("Montserrat", () => undefined)).toEqual(["Regular", "Italic", "Bold", "Bold Italic"])
  expect(controls("Montserrat Light", () => undefined)).toEqual(["Light", "Regular", "Italic", "Bold", "Bold Italic"])
})

it("shows a template font's family while retaining its native token and matching style", () => {
  const panel = panelOf(
    {
      ...shape,
      value: writeTextValue([
        { from: 0, runs: [{ from: 0, text: "Title", font: "+mj-lt", color: { scheme: "dk1" } }] },
      ]),
      textStyles: [{ id: "title", name: "Title", fields: { font: "+mj-lt", color: { scheme: "dk1" } } }],
    },
    { fonts: { major: "Lato" }, reads: {}, moves: true },
  )
  const controls = panel.sections.find((section) => section.trait === "text")?.strips.flat() ?? []
  expect(controls.find((control) => control.field === "font")?.value).toBe("Lato")
  expect(controls.find((control) => control.field === "style")?.value).toBe("title")
  expect(
    controls.find((control) => control.field === "weight")?.choices?.some((choice) => choice.value === "Regular"),
  ).toBe(true)
})

it("routes a text box's Fill to its letters and keeps its box fill folded", () => {
  const panel = panelOf(shape, { reads: {}, moves: true })
  const fill = panel.sections.find((section) => section.trait === "textFill")?.strips.flat()[0]
  expect(fill?.desc).toMatchObject({
    kind: "union",
    cases: { solid: { kind: "color" }, gradient: { kind: "record" }, image: { kind: "asset" } },
  })
  expect(Object.keys(fill?.desc.kind === "union" ? fill.desc.cases : {})).toEqual(["solid", "gradient", "image"])
  expect(fill?.change({ image: "star" })).toEqual({ target: { node: shape.node }, text: { fill: { image: "star" } } })
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
