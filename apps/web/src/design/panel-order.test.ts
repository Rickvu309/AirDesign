import { authorableTrait } from "@airdesign/catalog"
import { elementId, kindTraits, opacityFields, type Kind, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf, type PanelReads } from "./panel"
import { panelKind, panelOrder, panelPlaces, type PanelKind } from "./panel-order"

const panelled = (Object.keys(kindTraits) as Kind[]).filter((kind) =>
  (kindTraits[kind] as readonly string[]).includes("identity"),
)

function panelsOf(kind: Kind): readonly PanelKind[] {
  return kind === "shape" ? ["text", "shape"] : [kind as PanelKind]
}

it("places every trait each element kind takes, and its Opacity, exactly once in each of its panels", () => {
  for (const kind of panelled) {
    const faded = opacityFields({ kind, text: true, grouped: false, animated: false }).length > 0
    const wanted = [
      ...kindTraits[kind].filter(authorableTrait),
      ...(faded ? ["opacity"] : []),
      ...(kind === "kept" ? [] : ["alignment"]),
    ].toSorted()
    for (const panel of panelsOf(kind)) {
      const placed = (panelOrder[panel] ?? []).map((place) => place.section)
      expect({
        panel,
        placed: placed
          .filter(
            (section) =>
              section !== "border" &&
              section !== "shadow" &&
              section !== "pictureFill" &&
              section !== "corners" &&
              section !== "textFill" &&
              section !== "paragraphSpacing" &&
              section !== "selectionColors",
          )
          .map((section) => (section === "boxFill" ? "fill" : section))
          .toSorted(),
      }).toEqual({ panel, placed: wanted })
    }
  }
})

it("puts alignment first for a text box", () => {
  expect(panelOrder.text[0]).toEqual({ section: "alignment", open: true, mode: "slides" })
})

const textBox: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: true, grouped: false, animated: false },
  kept: [],
  value: "Hello",
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

function shown(fields: Readonly<Record<string, unknown>>): PanelReads {
  return {
    reads: {},
    moves: true,
    fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, own: true }])),
  }
}

function sections(view: ScopedElement, fields: Readonly<Record<string, unknown>>) {
  return panelOf(view, shown(fields)).sections.map((section) => [section.trait, section.open])
}

it("orders a text box Text first, with its rare sections and its shape type folded", () => {
  expect(panelKind(textBox, shown({}))).toBe("text")
  expect(sections(textBox, { "fill.value": { none: true } })).toEqual([
    ["alignment", true],
    ["text", true],
    ["link", true],
    ["textFill", true],
    ["opacity", true],
    ["boxFill", false],
    ["paragraphSpacing", false],
    ["box", false],
    ["line", false],
    ["effects", false],
    ["body", false],
    ["geometry", false],
    ["identity", false],
  ])
})

it("orders a drawn shape by its fill, line and shape type", () => {
  const oval = { ...textBox, facts: { ...textBox.facts, text: false }, value: null }
  const fields = { "geometry.shape": { preset: "ellipse", adjust: {} } }
  expect(panelKind(oval, shown(fields))).toBe("shape")
  expect(sections(oval, fields)).toEqual([
    ["alignment", true],
    ["fill", true],
    ["opacity", true],
    ["border", true],
    ["shadow", true],
    ["geometry", false],
    ["line", false],
    ["effects", false],
    ["box", false],
    ["identity", false],
  ])
  const labelled = { ...textBox, value: "Go" }
  expect(panelKind(labelled, shown(fields))).toBe("shape")
  expect(sections(labelled, fields).map(([trait]) => trait)).toContain("text")
})

it("offers a picture no shape type while it is a plain rectangle", () => {
  const picture = { ...textBox, facts: { ...textBox.facts, kind: "picture" as const, text: false }, value: null }
  const plain = sections(picture, { "geometry.shape": { preset: "rect", adjust: {} } })
  expect(plain.map(([trait]) => trait)).toEqual([
    "alignment",
    "pictureFill",
    "opacity",
    "corners",
    "border",
    "shadow",
    "image",
    "crop",
    "box",
    "line",
    "effects",
    "identity",
  ])
  const oval = sections(picture, { "geometry.shape": { preset: "ellipse", adjust: {} } })
  expect(oval).toContainEqual(["geometry", false])
})

it("leads a connector with its line and the shapes it joins", () => {
  const connector = { ...textBox, facts: { ...textBox.facts, kind: "connector" as const, text: false }, value: null }
  expect(sections(connector, {}).slice(0, 3)).toEqual([
    ["alignment", true],
    ["border", true],
    ["shadow", true],
  ])
})

it.fails("keeps Position and size for a shape inside a group", () => {
  const child = { ...textBox, facts: { ...textBox.facts, grouped: true } }
  expect(sections(child, {}).map(([trait]) => trait)).toContain("box")
})

it("marks the simple sections separately from the exact PowerPoint controls", () => {
  const slides = (kind: PanelKind | "slide") => panelPlaces(kind, "slides").map(({ section }) => section)

  expect(slides("text")).toEqual(["alignment", "text", "link", "textFill", "opacity"])
  expect(slides("shape")).toEqual(["alignment", "fill", "opacity", "corners", "border", "shadow", "selectionColors"])
  expect(slides("picture")).toEqual(["alignment", "pictureFill", "opacity", "corners", "border", "shadow"])
  expect(slides("connector")).toEqual(["alignment", "border", "shadow"])
  expect(slides("many")).toEqual([
    "alignment",
    "text",
    "textFill",
    "fill",
    "opacity",
    "link",
    "corners",
    "border",
    "shadow",
    "selectionColors",
  ])
  expect(slides("slide")).toEqual(["templateStyle", "background", "selectionColors"])
})
