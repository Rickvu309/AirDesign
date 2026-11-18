import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { fillCopy } from "@/copy/fill-copy"
import { panelOf, type PanelSection } from "./panel"
import { sectionInMode } from "./panel-order"

const photo: ScopedElement = {
  node: elementId("258.4"),
  facts: { kind: "shape", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}
const none = { none: true } as const
const blue = { solid: { scheme: "accent1" } } as const

function fillSection(fields: Readonly<Record<string, unknown>>, mode: "slides" | "design"): PanelSection | undefined {
  const shown = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, own: true }]))
  const section = panelOf(photo, { reads: {}, moves: true, fields: shown }).sections.find(
    (each) => each.trait === "fills",
  )
  return section === undefined ? undefined : sectionInMode(section, mode)
}

const image = {
  "fills.p0": { image: true },
  "fills.p1": none,
  "fills.p2": none,
  "fills.p3": none,
  "fills.source": "rocket",
}

it("lists a photo's paints top first in design mode, each with its order actions, and adds a gradient above the image in one change", () => {
  const list = fillSection({ ...image, "fills.p1": blue }, "design")
  const strips = list?.strips ?? []
  expect(strips.map((strip) => strip.map((control) => control.field))).toEqual([
    ["order.1"],
    ["paint"],
    ["order.0"],
    ["paint"],
    ["mode"],
    ["blur"],
    ["add"],
  ])
  expect(strips[1]?.[0]?.value).toEqual(blue)
  expect(strips[3]?.[0]?.value).toEqual({ image: "rocket" })
  expect(strips[0]?.[0]?.desc).toEqual({ kind: "choice", options: ["down", "hide", "remove"] })
  expect(strips[0]?.[0]?.label).toBe(fillCopy.paint(1, 2))
  expect(strips[0]?.[0]?.look).toMatchObject({ name: { show: "above" }, form: "header" })
  expect(strips[2]?.[0]?.desc).toEqual({ kind: "choice", options: ["up", "hide", "remove"] })
  const held = strips[3]?.[0]?.desc
  expect(held?.kind === "union" ? Object.keys(held.cases) : []).toEqual(
    expect.arrayContaining(["none", "solid", "gradient", "image"]),
  )
  expect(held?.kind === "union" ? held.cases.image.kind : "").toBe("asset")
  expect(strips[3]?.[0]?.change({ solid: { scheme: "accent2" } })).toEqual({
    target: { node: "258.4" },
    fills: { p0: { solid: { scheme: "accent2" } } },
  })
  expect(strips[1]?.[0]?.change({ image: true })).toEqual({
    target: { node: "258.4" },
    fills: { p1: { image: true } },
  })
  const add = strips.at(-1)?.[0]
  expect(add?.change("gradient")).toMatchObject({
    target: { node: "258.4" },
    fills: { p2: { gradient: expect.anything() } },
  })
  expect(strips[0]?.[0]?.change("remove")).toEqual({ target: { node: "258.4" }, fills: { p1: none } })
  expect(strips[0]?.[0]?.change("down")).toEqual({
    target: { node: "258.4" },
    fills: { p0: blue, p1: { image: true } },
  })
  expect(strips[0]?.[0]?.change("hide")).toEqual({ target: { node: "258.4" }, fills: { p1: { hidden: blue } } })
})

it("keeps slides mode to one Fill control, and its Overlay edits the top paint above the image", () => {
  const slides = fillSection({ ...image, "fills.p2": blue }, "slides")
  expect(slides?.strips.flat().map((control) => control.field)).toEqual(["paint"])
  const shown = Object.fromEntries(
    Object.entries({ ...image, "fills.p2": blue }).map(([key, value]) => [key, { value, own: true }]),
  )
  const overlay = panelOf(photo, { reads: {}, moves: true, fields: shown })
    .sections.flatMap((section) => section.strips.flat())
    .find((control) => control.field === "overlay")
  expect(overlay?.value).toEqual(blue)
  expect(overlay?.change({ none: true })).toEqual({ target: { node: "258.4" }, fills: { p2: none } })
  const bare = Object.fromEntries(Object.entries(image).map(([key, value]) => [key, { value, own: true }]))
  const added = panelOf(photo, { reads: {}, moves: true, fields: bare })
    .sections.flatMap((section) => section.strips.flat())
    .find((control) => control.field === "overlay")
  expect(added?.change(blue)).toEqual({ target: { node: "258.4" }, fills: { p3: blue } })
})

it("lets a picture's only image be hidden or removed, with its fit mode and blur under it", () => {
  const strips = fillSection(image, "design")?.strips ?? []
  expect(strips.map((strip) => strip.map((control) => control.field))).toEqual([
    ["order.0"],
    ["paint"],
    ["mode"],
    ["blur"],
    ["add"],
  ])
  expect(strips[0]?.[0]?.desc).toEqual({ kind: "choice", options: ["hide", "remove"] })
  expect(strips[0]?.[0]?.change("hide")).toEqual({
    target: { node: "258.4" },
    fills: { p0: { hidden: { image: true } } },
  })
  expect(strips[0]?.[0]?.change("remove")).toEqual({ target: { node: "258.4" }, fills: { p0: none } })
  const { "fills.source": _icon, ...photo } = image
  const marked = fillSection(photo, "design")?.strips[1]?.[0]?.desc
  expect(marked?.kind === "union" ? marked.cases.image : null).toEqual({ kind: "mark" })
})
