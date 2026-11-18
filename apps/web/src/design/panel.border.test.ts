import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { borderCopy } from "@/copy/border-copy"
import { panelOf, panelOfMany, partControl, type ShownField } from "./panel"
import { sectionInMode, type PanelMode } from "./panel-order"

const connector: ScopedElement = {
  node: elementId("258.6"),
  facts: { kind: "connector", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 0 },
}

function borderRows(fill: unknown, mode: PanelMode, dash = "solid"): readonly (readonly string[])[] {
  const fields = { "border.fill": { value: fill, own: true }, "border.dash": { value: dash, own: false } }
  const panel = panelOf(connector, { reads: {}, moves: true, fields })
  const border = panel.sections.find((section) => section.trait === "border")
  return border === undefined ? [] : sectionInMode(border, mode).strips.map((strip) => strip.map(({ field }) => field))
}

it("shows one Border section: the presets alone while the border is none, in either mode", () => {
  expect(borderRows({ none: true }, "slides")).toEqual([["border"]])
  expect(borderRows({ none: true }, "design")).toEqual([["border"]])
})

it("shows Color and Border width under the presets, and in design mode the full paint and every exact setting", () => {
  const solid = { solid: { scheme: "accent1" } }
  expect(borderRows(solid, "slides")).toEqual([["border"], ["color", "width"]])
  const exact = [["border"], ["fill"], ["width"], ["dash"], ["cap", "compound"], ["join"], ["head", "tail"]]
  expect(borderRows(solid, "design")).toEqual(exact)
  expect(borderRows(solid, "slides", "lgDash")).toEqual([["border"]])
  expect(borderRows(solid, "design", "lgDash")).toEqual(exact)
})

it("keeps a gradient border's paint in design mode, named apart from the fill's", () => {
  const gradient = {
    gradient: {
      stops: [
        { at: 0, color: { scheme: "accent1" } },
        { at: 100_000, color: { scheme: "accent2" } },
      ],
      shade: { linear: { angle: 0, scaled: false } },
      rotateWithShape: true,
    },
  }
  expect(borderRows(gradient, "slides")).toEqual([["border"]])
  expect(borderRows(gradient, "design")).toEqual([
    ["border"],
    ["fill"],
    ["width"],
    ["dash"],
    ["cap", "compound"],
    ["join"],
    ["head", "tail"],
  ])
  const fields = { "border.fill": { value: gradient, own: true } }
  const border = panelOf(connector, { reads: {}, moves: true, fields }).sections.find(
    (section) => section.trait === "border",
  )
  const fill = border === undefined ? undefined : sectionInMode(border, "design").strips[1]?.[0]
  if (fill === undefined || fill.desc.kind !== "union") throw new Error("border fill")
  const solid = fill.desc.cases.solid
  if (solid === undefined) throw new Error("solid")
  expect(partControl(fill, "solid", solid, { scheme: "accent1" }).label).toBe("Border color")
  expect(fill.look.form).toBe("list")
})

const square: ScopedElement = {
  node: elementId("258.4"),
  facts: { kind: "shape", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

const solidBorder = {
  "border.fill": { value: { solid: { scheme: "accent1" } }, own: true },
  "border.dash": { value: "solid", own: false },
}

function geometry(preset: string | null, open = false): ShownField {
  const field: ShownField = { value: preset === null ? null : { preset, adjust: {} }, own: true }
  return open ? Object.assign(field, { open: true }) : field
}

function designFields(view: ScopedElement, fields: Readonly<Record<string, ShownField | undefined>>) {
  const border = panelOf(view, { reads: {}, moves: true, fields }).sections.find(
    (section) => section.trait === "border",
  )
  return border === undefined
    ? []
    : sectionInMode(border, "design").strips.map((strip) => strip.map(({ field }) => field))
}

it("offers the border paint as a word list in design mode and leaves slides mode on Color and Border width", () => {
  const fields = { ...solidBorder, "geometry.shape": geometry("rect") }
  expect(designFields(square, fields)).toEqual([
    ["border"],
    ["fill"],
    ["width"],
    ["dash"],
    ["cap", "compound"],
    ["join"],
  ])
  expect(borderRows({ solid: { scheme: "accent1" } }, "slides")).toEqual([["border"], ["color", "width"]])
})

it("shows arrowheads on a line, a connector and an open shape, and hides them on a closed shape", () => {
  const closed = [["border"], ["fill"], ["width"], ["dash"], ["cap", "compound"], ["join"]]
  const open = [...closed, ["head", "tail"]]
  expect(designFields(square, { ...solidBorder, "geometry.shape": geometry("rect") })).toEqual(closed)
  expect(designFields(square, { ...solidBorder, "geometry.shape": geometry("rightArrow") })).toEqual(closed)
  expect(designFields(square, { ...solidBorder, "geometry.shape": geometry(null) })).toEqual(closed)
  expect(designFields(square, { ...solidBorder, "geometry.shape": geometry("line") })).toEqual(open)
  expect(designFields(square, { ...solidBorder, "geometry.shape": geometry("arc") })).toEqual(open)
  expect(designFields(square, { ...solidBorder, "geometry.shape": geometry(null, true) })).toEqual(open)
  expect(designFields(connector, solidBorder)).toEqual(open)
  const picture = panelOf(square, {
    reads: {},
    moves: true,
    fields: {
      ...solidBorder,
      "fills.p0": { value: { image: { src: "a.png" } }, own: true },
      "geometry.shape": geometry("rect"),
    },
  })
  expect(picture.kind).toBe("picture")
  expect(
    sectionInMode(picture.sections.find((section) => section.trait === "border") ?? picture.sections[0]!, "design")
      .strips.flat()
      .map((control) => control.field),
  ).not.toContain("head")
  const line = panelOf(
    { ...square, node: elementId("258.5") },
    { reads: {}, moves: true, fields: { ...solidBorder, "geometry.shape": geometry("line") } },
  )
  const shared = panelOfMany([picture, line], "design")
  expect(
    shared.sections
      .find((section) => section.trait === "border")
      ?.strips.flat()
      .map((control) => control.field),
  ).not.toContain("tail")
})

it("shows an unset cap and join as the values PowerPoint paints, and Reset on a set cap", () => {
  const fields = {
    ...solidBorder,
    "geometry.shape": geometry("rect"),
    "border.cap": { value: "flat", own: false },
    "border.join": { value: "round", own: false },
  }
  const shown = panelOf(square, { reads: {}, moves: true, fields })
  const controls = sectionInMode(
    shown.sections.find((section) => section.trait === "border") ?? shown.sections[0]!,
    "design",
  ).strips.flat()
  expect(controls.find((control) => control.field === "cap")).toMatchObject({
    value: "flat",
    inherited: true,
    reset: null,
  })
  expect(controls.find((control) => control.field === "join")).toMatchObject({
    value: "round",
    inherited: true,
    reset: null,
  })
  const set = panelOf(square, {
    reads: {},
    moves: true,
    fields: { ...fields, "border.cap": { value: "rnd", own: true } },
  })
  const cap = sectionInMode(set.sections.find((section) => section.trait === "border") ?? set.sections[0]!, "design")
    .strips.flat()
    .find((control) => control.field === "cap")
  expect(cap).toMatchObject({ value: "rnd", inherited: false, reset: borderCopy.reset.cap })
  expect(cap?.change(null)).toEqual({ target: { node: square.node }, border: { cap: null } })
})
