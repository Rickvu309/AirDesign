import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { frameCopy } from "@/copy/frame-copy"
import { framePanel } from "./frame-panel"
import { panelOf } from "./panel"
import { panelPlaces } from "./panel-order"

const frame: ScopedElement = {
  node: elementId("258.20"),
  facts: { kind: "group", text: false, grouped: false, animated: false, frame: "auto" },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 457_200 },
}

const backdrop: ScopedElement = {
  node: elementId("258.21"),
  facts: { kind: "shape", text: false, grouped: true, animated: false, framed: "auto", backdrop: true },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 457_200 },
}

const fields = {
  "geometry.shape": { value: { preset: "rect", adjust: {} }, own: true },
  "fills.p0": { value: null, own: true },
  "border.fill": { value: { none: true }, own: true },
  "border.dash": { value: "solid", own: false },
  "effects.shadow": { value: null, own: true },
}

function model(auto: boolean) {
  const own = panelOf(frame, { reads: {}, moves: true, fields })
  const under = panelOf(backdrop, { reads: {}, moves: false, fields })
  return framePanel(own, under, auto)
}

it("orders an auto layout frame's slides panel as Figma does, with Fill, Border and Corners from its backdrop", () => {
  const shown = model(true)
  expect(shown.kind).toBe("frame")
  expect(shown.frame).toBe("auto")
  expect(panelPlaces("frame", "slides").map(({ section }) => section)).toEqual([
    "alignment",
    "fills",
    "opacity",
    "corners",
    "border",
    "shadow",
    "selectionColors",
  ])
  expect(shown.sections.map(({ trait }) => trait).filter((trait) => trait !== "box" && trait !== "identity")).toEqual([
    "alignment",
    "fills",
    "opacity",
    "corners",
    "border",
    "shadow",
    "layout",
    "effects",
  ])
  const fill = shown.sections.find(({ trait }) => trait === "fills")?.strips.flat()[0]
  expect(fill?.change({ none: true }).target).toEqual({ node: backdrop.node })
  expect(fill?.desc.kind === "union" && Object.keys(fill.desc.cases)).not.toContain("group")
  const shadow = shown.sections.find(({ trait }) => trait === "shadow")?.strips.flat()[0]
  expect(shadow?.change("none").target).toEqual({ node: frame.node })
})

it("fades the whole frame from its own Opacity row, which reads the frame's opacity", () => {
  const own = panelOf(frame, {
    reads: {},
    moves: true,
    fields: { ...fields, "layout.opacity": { value: 40_000, own: true } },
  })
  const under = panelOf(backdrop, { reads: {}, moves: false, fields })
  const opacity = framePanel(own, under, true)
    .sections.find(({ trait }) => trait === "opacity")
    ?.strips.flat()[0]
  expect(opacity?.value).toBe(40_000)
  expect(opacity?.change(50_000).target).toEqual({ node: frame.node })
  expect(opacity?.look.steps).toBeDefined()
})

it("titles a frame whose auto layout was removed as a frame", () => {
  expect(model(false).frame).toBe("free")
})

const sizing = (model: ReturnType<typeof panelOf>) => {
  const section = model.sections.find(({ trait }) => trait === "layout")
  const choices = section?.strips
    .flat()
    .filter(({ field }) => field === "width" || field === "height")
    .map((control) => [control.field, control.desc.kind === "choice" ? control.desc.options : [], control.value])
  return { label: section?.label, choices }
}

it("gives a layer in an auto layout frame a Resizing section with Width and Height, Fixed or Fill container", () => {
  const child: ScopedElement = {
    ...backdrop,
    node: elementId("258.3"),
    parent: frame.node,
    facts: { kind: "shape", text: false, grouped: true, animated: false, framed: "auto" },
  }
  const fill = { "layout.width": { value: "fill", own: true }, "layout.height": { value: "fixed", own: true } }
  expect(sizing(panelOf(child, { reads: {}, moves: true, fields: { ...fields, ...fill } }))).toEqual({
    label: frameCopy.resizing,
    choices: [
      ["width", ["fixed", "fill"], "fill"],
      ["height", ["fixed", "fill"], "fixed"],
    ],
  })
})

it("offers Hug contents, Fixed and Fill container to a frame inside an auto layout frame, and no Fill to a frame on the slide", () => {
  const inner: ScopedElement = { ...frame, facts: { ...frame.facts, grouped: true, framed: "auto" } }
  const hugging = { "layout.width": { value: "hug", own: true }, "layout.height": { value: "hug", own: true } }
  expect(sizing(panelOf(inner, { reads: {}, moves: true, fields: { ...fields, ...hugging } })).choices).toEqual([
    ["width", ["hug", "fixed", "fill"], "hug"],
    ["height", ["hug", "fixed", "fill"], "hug"],
  ])
  expect(sizing(panelOf(frame, { reads: {}, moves: true, fields: { ...fields, ...hugging } }))).toEqual({
    label: frameCopy.autoLayout,
    choices: [
      ["width", ["hug", "fixed"], "hug"],
      ["height", ["hug", "fixed"], "hug"],
    ],
  })
})
