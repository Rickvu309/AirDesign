import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { matchingLayers, type MatchSlide, type MatchLayer } from "./matching-layers"

const box = (y: number) => ({ x: 10, y, width: 80, height: 10, rotation: 0, flipH: false, flipV: false })
const footer = { type: "ftr", index: 2 }
const layer = (node: string, fields: Partial<MatchLayer> = {}): MatchLayer => ({
  node: elementId(node),
  name: "Footer",
  kind: "p:sp",
  group: null,
  placeholder: null,
  box: box(90),
  text: null,
  ...fields,
})
const slide = (layers: MatchLayer[], layout = "layout1"): MatchSlide => ({ layout, layers })
const matches = (slides: MatchSlide[], node = "256.2") => matchingLayers(slides, [elementId(node)])

it("matches placeholder type and index on the same layout, even when names differ", () => {
  const slides = [
    slide([layer("256.2", { placeholder: footer })]),
    slide([layer("257.2", { name: "Other name", placeholder: footer })]),
    slide([layer("258.2", { placeholder: footer })], "layout2"),
    slide([layer("259.2"), layer("259.3", { placeholder: { ...footer, index: 3 } })]),
  ]
  expect(matches(slides)).toEqual(["257.2"])
})

it("matches names and the full named group path at the same position in the hierarchy", () => {
  const group = (node: string, name: string) => layer(node, { name, kind: "p:grpSp" })
  expect(
    matches([
      slide([group("256.3", "Footer group"), layer("256.2", { group: "3" })]),
      slide([group("257.9", "Footer group"), layer("257.2", { group: "9" })]),
      slide([group("258.3", "Header group"), layer("258.2", { group: "3" })]),
      slide([
        group("259.3", "Footer group"),
        layer("259.4", { name: "Icon", group: "3" }),
        layer("259.2", { group: "3" }),
      ]),
      slide([layer("260.2")]),
    ]),
  ).toEqual(["257.2"])
})

it("chooses the closest equally styled text box when PowerPoint assigned the names", () => {
  const text = {
    paragraphs: [],
    anchor: "top",
    insets: { left: 0, top: 0, right: 0, bottom: 0 },
    wrap: true,
    fit: "none",
    vertical: false,
    flow: "horz",
    columns: 1,
    columnGap: 0,
    fontScale: 1,
    spacingReduction: 0,
  } as const
  expect(
    matches([
      slide([layer("256.2", { name: "TextBox 2", text })]),
      slide([
        layer("257.2", { name: "TextBox 2", text, box: box(10) }),
        layer("257.3", { name: "Shape 3", text, box: box(88) }),
        layer("257.4", { name: "TextBox 4", renamed: true, text, box: box(90) }),
        layer("257.5", { name: "TextBox 5", text: { ...text, anchor: "bottom" }, box: box(90) }),
      ]),
      slide([layer("258.2", { name: "TextBox 2", text }), layer("258.3", { name: "TextBox 3", text })]),
    ]),
  ).toEqual(["257.3"])
})
