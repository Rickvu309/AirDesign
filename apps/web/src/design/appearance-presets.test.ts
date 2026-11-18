import { alphaOf, elementId, type ScopedElement } from "@airdesign/document"
import { Minus } from "lucide-react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { effectsWords } from "@/copy/effects-copy"
import { borderCopy, borderWords } from "@/copy/border-copy"
import { opacityCopy } from "@/copy/opacity-copy"
import { optionWord } from "@/copy/option-copy"
import { borderWidths } from "./appearance-presets"
import { ChoiceControl } from "./controls/choice"
import { panelOf } from "./panel"

const view: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914400, cy: 914400 },
}

function panel(fields: Readonly<Record<string, unknown>> = {}) {
  return panelOf(view, {
    reads: {},
    moves: true,
    fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, own: true }])),
  })
}

function preset(trait: string, fields: Readonly<Record<string, unknown>> = {}) {
  const control = panel(fields)
    .sections.find((section) => section.trait === trait)
    ?.strips.flat()[0]
  expect(control).toBeDefined()
  if (control === undefined) throw new Error(trait)
  return control
}

it("orders shape appearance before its shut detail sections", () => {
  expect(
    panel()
      .sections.map(({ trait, open }) => [trait, open])
      .slice(0, 8),
  ).toEqual([
    ["alignment", true],
    ["fills", true],
    ["opacity", true],
    ["border", true],
    ["shadow", true],
    ["geometry", false],
    ["effects", false],
    ["box", false],
  ])
})

it("writes each border preset and recognizes only exact supported appearances", () => {
  const border = preset("border")
  expect(border.change("none")).toEqual({ target: { node: view.node }, border: { fill: { none: true } } })
  for (const dash of ["solid", "dash", "dot"]) {
    const change = border.change(dash)
    expect(change).toEqual({ target: { node: view.node }, border: { fill: { solid: { scheme: "tx1" } }, dash } })
    expect(preset("border", { "border.fill": { solid: { rgb: "123456" } }, "border.dash": dash }).value).toBe(dash)
  }
  expect(preset("border", { "border.fill": { none: true } }).value).toBe("none")
  expect(preset("border", { "border.fill": { gradient: {} }, "border.dash": "solid" }).value).toBeUndefined()
  expect(preset("border", { "border.fill": { solid: {} }, "border.dash": "dashDot" }).value).toBeUndefined()
})

it("writes fixed outer shadow strengths, recognizes each and leaves custom shadows unpressed", () => {
  const shadow = preset("shadow")
  expect(shadow.change("none")).toEqual({ target: { node: view.node }, effects: { shadow: { none: true } } })
  for (const strength of ["subtle", "medium", "strong"]) {
    const change = shadow.change(strength)
    expect(change.effects?.shadow).toHaveProperty("outer")
    expect(preset("shadow", { "effects.shadow": change.effects?.shadow }).value).toBe(strength)
  }
  expect(preset("shadow", { "effects.shadow": { none: true } }).value).toBe("none")
  expect(preset("shadow", { "effects.shadow": { outer: { blur: 999 } } }).value).toBeUndefined()
})

function borderSection(kind: "shape" | "picture" | "connector", fill: unknown, dash: unknown) {
  const image = kind === "picture" ? { "fills.p0": { value: { image: true }, own: true } } : {}
  return panelOf(
    {
      ...view,
      facts: { ...view.facts, kind: kind === "picture" ? "shape" : kind, text: kind !== "picture" && view.facts.text },
    },
    {
      reads: {},
      moves: true,
      fields: {
        ...image,
        "border.fill": { value: fill, own: true },
        "border.dash": { value: dash, own: true },
      },
    },
  ).sections.find(({ trait }) => trait === "border")
}

it("shows Color and Border width under solid, dashed and dotted for shapes, pictures and lines", () => {
  for (const kind of ["shape", "picture", "connector"] as const) {
    for (const dash of ["solid", "dash", "dot"] as const) {
      const controls = borderSection(kind, { solid: { rgb: "000000" } }, dash)?.strips.flat() ?? []
      expect(controls.map(({ field }) => field)).toEqual(["border", "color", "width"])
      expect(controls[0]?.desc).toMatchObject({
        options: kind === "connector" ? ["solid", "dash", "dot"] : ["none", "solid", "dash", "dot"],
      })
      expect(controls[1]?.label).toBe(borderCopy.color)
      expect(controls[2]?.label).toBe(borderCopy.width)
      expect(controls[2]?.look.glyph).toBe(Minus)
      expect(controls[2]?.look.steps).toEqual([...borderWidths])
      expect(controls[2]?.look.unit).toBe("")
    }
    expect(
      borderSection(kind, { none: true }, "solid")
        ?.strips.flat()
        .map(({ field }) => field),
    ).toEqual(["border"])
  }
})

it("writes shadow opacity into the shadow colour and keeps the strength pressed", () => {
  const written = preset("shadow").change("medium")
  const held = written.effects?.shadow
  const controls = panel({ "effects.shadow": held })
    .sections.find((section) => section.trait === "shadow")
    ?.strips.flat()
  const opacity = controls?.find((control) => control.field === "opacity")
  expect(opacity?.label).toBe(opacityCopy.label)
  expect(opacity?.look.slider).toBe(true)
  if (opacity === undefined || typeof held !== "object" || held === null || !("outer" in held))
    throw new Error("opacity")
  const outer = held.outer
  if (typeof outer !== "object" || outer === null || !("color" in outer)) throw new Error("outer")
  expect(opacity.value).toBe(alphaOf(outer.color))
  const next = opacity.change(40_000)
  const faded = next.effects?.shadow
  if (typeof faded !== "object" || faded === null || !("outer" in faded)) throw new Error("faded")
  const again = faded.outer
  if (typeof again !== "object" || again === null || !("color" in again) || !("blur" in again)) throw new Error("again")
  expect(again.blur).toBe("blur" in outer ? outer.blur : undefined)
  expect("distance" in again ? again.distance : undefined).toBe("distance" in outer ? outer.distance : undefined)
  expect("direction" in again ? again.direction : undefined).toBe("direction" in outer ? outer.direction : undefined)
  expect(alphaOf(again.color)).toBe(40_000)
  expect(preset("shadow", { "effects.shadow": faded }).value).toBe("medium")
  for (const shadow of [{ none: true }, { outer: { blur: 999 } }])
    expect(
      panel({ "effects.shadow": shadow })
        .sections.find((section) => section.trait === "shadow")
        ?.strips.flat()
        .map((control) => control.field),
    ).toEqual(["shadow"])
})

it("does not name the three shadow strengths soft, medium or hard", () => {
  const words = ["subtle", "medium", "strong"].map((name) => optionWord("shadow", name))
  expect(words).toEqual(["subtle", "medium", "strong"].map((name) => effectsWords[`shadow.${name}`]))
  for (const word of words) expect(word.toLowerCase()).not.toMatch(/soft|medium|hard/)
  expect(new Set(words).size).toBe(words.length)
  const shadow = preset("shadow")
  expect(shadow.look.unnamed).toBe(true)
  const html = renderToStaticMarkup(
    createElement(ChoiceControl, { control: shadow, palette: { theme: [], deck: [] }, onChange: () => {} }),
  )
  for (const word of words) expect(html).toContain(`aria-label="${word}"`)
  expect(html).not.toContain("title=")
  const border = renderToStaticMarkup(
    createElement(ChoiceControl, {
      control: preset("border"),
      palette: { theme: [], deck: [] },
      onChange: () => {},
    }),
  )
  expect(border).toContain(`title="${borderWords["border.solid"]}"`)
})
