import { elementId, slideId, traitNames, traits, type Desc, type TraitName } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import * as z from "zod/v4"
import { colorPattern } from "./agent-color.js"
import { flat } from "./agent-form.js"
import { readAgentEdit, toolInputSchema } from "./index.js"
import { addChangeSchema, readAddChange, readSetChange, readTarget, setChangeSchema } from "./set-wire.js"
import { opacityWire } from "./opacity-wire.js"
import { traitWire } from "./trait-wire.js"

const black = "000000"

const title = elementId("258.2")
const navy = "1F4E79"

describe("readTarget names a node, a slide, a role on one slide, or a role on every slide", () => {
  it("reads each form", () => {
    expect(readTarget("258.2")).toEqual({ node: title })
    expect(readTarget("258.notes")).toEqual({ node: elementId("258.notes") })
    expect(readTarget("258.title")).toEqual({ role: "title", slide: slideId("258") })
    expect(readTarget("*.subtitle")).toEqual({ role: "subtitle", slide: "every" })
    expect(readTarget("258")).toEqual({ slide: slideId("258") })
    expect(readTarget("258.slide")).toEqual({ node: elementId("258.slide") })
  })

  it("refuses an unknown role, a wildcard node and a slide id that is not one", () => {
    for (const raw of ["258.headline", "*.7", "*.*", "*", "", "258.", "n4k2j9x0q1zab", 258, null])
      expect(readTarget(raw)).toBeNull()
  })
})

describe("readSetChange reads the agent form into a change in stored units", () => {
  it("recolours every title", () => {
    expect(readSetChange({ op: "set", target: "*.title", text: { color: "accent1" } })).toEqual({
      ok: true,
      change: { op: "set", target: { role: "title", slide: "every" }, text: { color: { scheme: "accent1" } } },
    })
  })

  it("turns points into EMU and type sizes into hundredths of a point", () => {
    expect(
      readSetChange({ op: "set", target: "258.2", box: { x: 72, w: 288 }, text: { size: 36, bold: true } }),
    ).toEqual({
      ok: true,
      change: {
        op: "set",
        target: { node: title },
        box: { x: 914_400, w: 3_657_600 },
        text: { size: 3_600, bold: true },
      },
    })
  })

  it("reads effects in points, degrees and colours, and a soft edge as its bare radius", () => {
    expect(
      readSetChange({
        op: "set",
        target: "258.2",
        effects: {
          shadow: { outer: { blur: 4, distance: 3, direction: 45, color: `#${black} alpha 35` } },
          glow: "none",
          softEdge: 5,
        },
      }),
    ).toEqual({
      ok: true,
      change: {
        op: "set",
        target: { node: title },
        effects: {
          shadow: {
            outer: {
              blur: 50_800,
              distance: 38_100,
              direction: 2_700_000,
              color: { rgb: "000000", transforms: [{ op: "alpha", val: 35_000 }] },
            },
          },
          glow: { none: true },
          softEdge: { radius: 63_500 },
        },
      },
    })
  })

  it("names the field it refuses", () => {
    const refused = (raw: Record<string, unknown>) => readSetChange({ op: "set", target: "258.2", ...raw })
    expect(refused({ box: { x: 914_400 } })).toEqual({ ok: false, refusal: "field", field: "box.x" })
    expect(refused({ box: { rot: 360 } })).toEqual({ ok: false, refusal: "field", field: "box.rot" })
    expect(refused({ box: { align: "centre" } })).toEqual({ ok: false, refusal: "field", field: "box.align" })
    expect(refused({ geometry: { shape: { preset: "heart", adjust: {} } } })).toEqual({
      ok: false,
      refusal: "field",
      field: "geometry.shape",
    })
    expect(refused({ geometry: { shape: { preset: "rect", adjust: { adj: 1 } } } })).toEqual({
      ok: false,
      refusal: "field",
      field: "geometry.shape",
    })
    expect(refused({ text: { color: "accent9" } })).toEqual({ ok: false, refusal: "field", field: "text.color" })
    expect(refused({ fills: { paint: "accent9" } })).toEqual({ ok: false, refusal: "field", field: "fills.paint" })
    expect(refused({ box: { x: null } })).toEqual({ ok: false, refusal: "field", field: "box.x" })
    expect(refused({ effects: { glow: 1 } })).toEqual({ ok: false, refusal: "field", field: "effects.glow" })
    expect(refused({ effects: { softEdge: null } })).toEqual({ ok: false, refusal: "field", field: "effects.softEdge" })
    expect(refused({ connection: { start: 1 } })).toEqual({ ok: false, refusal: "field", field: "connection.start" })
    expect(refused({ connection: { start: { shape: { node: "258.7", site: 8 } } } })).toEqual({
      ok: false,
      refusal: "field",
      field: "connection.start",
    })
    expect(refused({ fills: { left: 1 } })).toEqual({ ok: false, refusal: "field", field: "fills.left" })
    expect(refused({ fills: { source: "rocketship" } })).toEqual({ ok: false, refusal: "field", field: "fills.source" })
    expect(refused({ fills: { source: "Rocket" } })).toEqual({ ok: false, refusal: "field", field: "fills.source" })
    expect(refused({ line: { width: 1585 } })).toEqual({ ok: false, refusal: "field", field: "line.width" })
    expect(refused({ line: { dash: "dotted" } })).toEqual({ ok: false, refusal: "field", field: "line.dash" })
    expect(refused({ box: {} })).toEqual({ ok: false, refusal: "field", field: "box" })
    for (const opacity of [101, -1, "60", null, true])
      expect(refused({ opacity })).toEqual({ ok: false, refusal: "field", field: "opacity" })
    expect(refused({})).toEqual({ ok: false, refusal: "field", field: "set" })
    expect(readSetChange({ op: "set", target: "258.headline", box: { x: 1 } })).toEqual({
      ok: false,
      refusal: "field",
      field: "target",
    })
    expect(readSetChange({ op: "set", target: "258", fills: { paint: "accent2" } })).toEqual({
      ok: true,
      change: { op: "set", target: { slide: "258" }, fills: { paint: { solid: { scheme: "accent2" } } } },
    })
    expect(readSetChange({ target: "258.2", box: { x: 1 } })).toEqual({ ok: false, refusal: "field", field: "op" })
  })
})

describe("readSetChange reads a turn in degrees, flips, a preset with its adjusts, and align and distribute", () => {
  it("turns degrees into 60000ths and keeps flips, presets and the box inputs as they are", () => {
    expect(
      readSetChange({
        op: "set",
        target: "*.title",
        box: { rot: 90, flipH: true, align: "center", distribute: "vertical" },
        geometry: { shape: { preset: "roundRect", adjust: { adj: 30_000 } } },
      }),
    ).toEqual({
      ok: true,
      change: {
        op: "set",
        target: { role: "title", slide: "every" },
        box: { rot: 5_400_000, flipH: true, align: "center", distribute: "vertical" },
        geometry: { shape: { preset: "roundRect", adjust: { adj: 30_000 } } },
      },
    })
  })
})

describe("readSetChange reads an element's one opacity in percent", () => {
  it("turns percent into alpha, alone or beside other fields", () => {
    expect(readSetChange({ op: "set", target: "*.title", opacity: 60 })).toEqual({
      ok: true,
      change: { op: "set", target: { role: "title", slide: "every" }, opacity: 60_000 },
    })
    expect(readSetChange({ op: "set", target: "258.2", opacity: 12.5, fills: { paint: "accent2" } })).toEqual({
      ok: true,
      change: {
        op: "set",
        target: { node: title },
        opacity: 12_500,
        fills: { paint: { solid: { scheme: "accent2" } } },
      },
    })
  })

  it("names no alpha on a trait, since opacity fades every field at once", () => {
    expect(readSetChange({ op: "set", target: "258.2", fills: { alpha: 60 } })).toEqual({
      ok: false,
      refusal: "field",
      field: "fills.alpha",
    })
  })
})

describe("readSetChange reads a fill in each of its forms", () => {
  const fill = (value: unknown) => {
    const read = readSetChange({ op: "set", target: "258.2", fill: { value } })
    return read.ok ? read.change.fills?.paint : read
  }

  it("reads a bare color as one color, a mark by its name, and null as the way back to the inherited fill", () => {
    expect(fill("accent2")).toEqual({ solid: { scheme: "accent2" } })
    expect(fill(`#${navy} lumMod 75`)).toEqual({ solid: { rgb: navy, transforms: [{ op: "lumMod", val: 75_000 }] } })
    expect(fill({ solid: "tx1" })).toEqual({ solid: { scheme: "tx1" } })
    expect(fill("none")).toEqual({ none: true })
    expect(fill("group")).toEqual({ group: true })
    expect(fill(null)).toBeNull()
  })

  it("reads a gradient's stops and angle in percent and degrees, and a pattern by its preset", () => {
    const stops = [
      { pos: 0, color: "accent1" },
      { pos: 100, color: "accent1 lumMod 50" },
    ]
    expect(
      fill({ gradient: { stops, shade: { linear: { angle: 90, scaled: true } }, rotateWithShape: true } }),
    ).toEqual({
      gradient: {
        stops: [
          { pos: 0, color: { scheme: "accent1" } },
          { pos: 100_000, color: { scheme: "accent1", transforms: [{ op: "lumMod", val: 50_000 }] } },
        ],
        shade: { linear: { angle: 5_400_000, scaled: true } },
        rotateWithShape: true,
      },
    })
    const focus = { l: 50, t: 50, r: 50, b: 50 }
    expect(
      fill({ gradient: { stops, shade: { path: { kind: "circle", focus } }, rotateWithShape: false } }),
    ).toMatchObject({
      gradient: { shade: { path: { kind: "circle", focus: { l: 50_000, t: 50_000, r: 50_000, b: 50_000 } } } },
    })
    expect(fill({ pattern: { preset: "dkDnDiag", fg: "accent2", bg: "bg1" } })).toEqual({
      pattern: { preset: "dkDnDiag", fg: { scheme: "accent2" }, bg: { scheme: "bg1" } },
    })
  })

  it("refuses one stop, eleven stops, a pattern PowerPoint does not name and a picture", () => {
    const stop = { pos: 0, color: "accent1" }
    const shade = { linear: { angle: 0, scaled: false } }
    const refused = { ok: false, refusal: "field", field: "fills.paint" }
    expect(fill({ gradient: { stops: [stop], shade, rotateWithShape: true } })).toEqual(refused)
    expect(fill({ gradient: { stops: Array(11).fill(stop), shade, rotateWithShape: true } })).toEqual(refused)
    expect(fill({ pattern: { preset: "stripes", fg: "accent2", bg: "bg1" } })).toEqual(refused)
    expect(fill("picture")).toEqual(refused)
  })
})

describe("readAddChange reads a new shape on one slide", () => {
  it("reads its box in points and its text inputs", () => {
    expect(
      readAddChange({
        op: "add",
        kind: "shape",
        slide: "258",
        box: { x: 72, y: 72, w: 144, h: 36 },
        text: { value: "New", color: `#${navy}` },
      }),
    ).toEqual({
      ok: true,
      change: {
        op: "add",
        kind: "shape",
        slide: slideId("258"),
        box: { x: 914_400, y: 914_400, cx: 1_828_800, cy: 457_200 },
        text: { value: "New", color: { rgb: navy } },
      },
    })
    expect(readAddChange({ op: "add", kind: "shape", slide: "258" })).toEqual({
      ok: true,
      change: { op: "add", kind: "shape", slide: slideId("258") },
    })
    expect(readAddChange({ op: "add", kind: "shape", slide: "258", icon: "rocket" })).toEqual({
      ok: true,
      change: { op: "add", kind: "shape", slide: slideId("258"), icon: "rocket" },
    })
  })

  it("wants all four box fields, a size above zero, and a kind it can build", () => {
    const add = { op: "add", kind: "shape", slide: "258" }
    expect(readAddChange({ ...add, box: { x: 1, y: 1, w: 1 } })).toEqual({ ok: false, refusal: "field", field: "box" })
    expect(readAddChange({ ...add, box: { x: 1, y: 1, w: 0, h: 1 } })).toEqual({
      ok: false,
      refusal: "field",
      field: "box",
    })
    expect(readAddChange({ ...add, kind: "picture" })).toEqual({ ok: false, refusal: "field", field: "icon" })
    expect(readAddChange({ ...add, kind: "picture", icon: "rocketship" })).toEqual({
      ok: false,
      refusal: "field",
      field: "icon",
    })
    expect(readAddChange({ ...add, kind: "picture", icon: "rocket", text: { value: "x" } })).toEqual({
      ok: false,
      refusal: "field",
      field: "text",
    })
    expect(readAddChange({ ...add, icon: "rocket", text: { value: "x" } })).toEqual({
      ok: false,
      refusal: "field",
      field: "text",
    })
    expect(readAddChange({ ...add, kind: "chart" })).toEqual({ ok: false, refusal: "field", field: "kind" })
    expect(readAddChange({ ...add, slide: "258.2" })).toEqual({ ok: false, refusal: "field", field: "slide" })
    expect(readAddChange({ ...add, line: { width: 1 } })).toEqual({ ok: false, refusal: "field", field: "line" })
    expect(readAddChange({ ...add, box: { x: 1, y: 1, w: 1, h: 1, rot: 90 } })).toEqual({
      ok: false,
      refusal: "field",
      field: "box",
    })
  })
})

describe("the set and add schemas derive from the agent forms", () => {
  const wired = traitNames.filter((trait) => Object.keys(traitWire[trait].fields).length > 0)

  it("are flat and offer every trait with a field an agent may name", () => {
    expect(flat(setChangeSchema())).toBe(true)
    expect(flat(addChangeSchema())).toBe(true)
    const properties = setChangeSchema().properties as Readonly<Record<string, unknown>>
    expect(Object.keys(properties)).toEqual(["op", "target", "opacity", ...wired])
    expect(properties.opacity).toMatchObject({ type: "number", minimum: 0, maximum: 100 })
  })

  it("never spends a description on the options its schema already lists", () => {
    const quoted = (desc: Desc): readonly (readonly string[])[] => {
      if (desc.kind === "choice") return [desc.options]
      if (desc.kind === "record") return Object.values(desc.fields).flatMap(quoted)
      if (desc.kind === "union") return Object.values(desc.cases).flatMap(quoted)
      return desc.kind === "list" || desc.kind === "named" ? quoted(desc.item) : []
    }
    for (const trait of wired) {
      const kinds = { ...traits[trait].fields, ...traits[trait].inputs } as Readonly<Record<string, { desc: Desc }>>
      const fields = traitWire[trait as TraitName].fields as Readonly<Record<string, { readonly description: string }>>
      for (const [field, { description }] of Object.entries(fields)) {
        const listed = quoted(kinds[field]?.desc ?? { kind: "mark" }).filter((options) =>
          options.every((option) => description.includes(`"${option}"`)),
        )
        expect(listed, `${trait}.${field}`).toEqual([])
      }
    }
  })

  it("takes every field's example, and the reader reads it", () => {
    const check = z.fromJSONSchema(setChangeSchema())
    for (const trait of wired) {
      const fields = traitWire[trait as TraitName].fields as Readonly<Record<string, { readonly example: object }>>
      for (const [field, { example }] of Object.entries(fields)) {
        const change = { op: "set", target: "258.2", ...example }
        expect(check.safeParse(change).success, `${trait}.${field}`).toBe(true)
        expect(readSetChange(change).ok, `${trait}.${field}`).toBe(true)
      }
    }
    const opacity = { op: "set", target: "258.2", ...opacityWire.example }
    expect(check.safeParse(opacity).success).toBe(true)
    expect(readSetChange(opacity).ok).toBe(true)
    expect(check.safeParse({ op: "set", target: "258.2", opacity: 101 }).success).toBe(false)
    expect(check.safeParse({ op: "set", target: "258.2", text: { color: "accent9" } }).success).toBe(false)
    expect(check.safeParse({ op: "set", target: "*.title", fills: { paint: null } }).success).toBe(true)
    expect(check.safeParse({ op: "set", target: "*.title", text: { color: null } }).success).toBe(false)
  })

  it("names the colour form once in the tool's $defs and points every colour field at it", () => {
    const schema = toolInputSchema("edit_deck") as { readonly $defs?: Readonly<Record<string, unknown>> }
    const nodes = (value: unknown): readonly Readonly<Record<string, unknown>>[] => {
      if (Array.isArray(value)) return value.flatMap(nodes)
      if (typeof value !== "object" || value === null) return []
      const node = value as Readonly<Record<string, unknown>>
      return [node, ...Object.values(node).flatMap(nodes)]
    }
    expect(schema.$defs?.color).toEqual({ type: "string", pattern: `^${colorPattern}$` })
    expect(nodes(schema).filter((node) => node.pattern === `^${colorPattern}$`)).toHaveLength(1)
    expect(nodes(schema).filter((node) => node.$ref === "#/$defs/color").length).toBeGreaterThanOrEqual(10)
    const check = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0])
    const edit = (color: string) => ({
      deck: "deck",
      base: 0,
      changes: [{ op: "set", target: "*.title", text: { color } }],
    })
    expect(check.safeParse(edit("accent1 lumMod 75")).success).toBe(true)
    expect(check.safeParse(edit("accent9")).success).toBe(false)
  })

  it("rides in airdesign_edit_deck beside the text and box changes, which read as before", () => {
    const schema = JSON.stringify(toolInputSchema("edit_deck"))
    expect(schema).toContain('"const":"set"')
    expect(schema).toContain('"const":"add"')
    const read = readAgentEdit({
      deck: "deck",
      base: 3,
      changes: [
        { value: "Hi", node: "258.2", readAt: 0 },
        { op: "set", target: "*.title", text: { bold: true } },
        { op: "add", kind: "shape", slide: "258" },
      ],
    })
    expect(read).toEqual({
      ok: true,
      deck: "deck",
      base: 3,
      changes: [
        { value: "Hi", node: title, readAt: 0 },
        { op: "set", target: { role: "title", slide: "every" }, text: { bold: true } },
        { op: "add", kind: "shape", slide: slideId("258") },
      ],
    })
    expect(
      readAgentEdit({ deck: "deck", base: 3, changes: [{ op: "set", target: "*.title", text: { bold: 1 } }] }),
    ).toEqual({
      ok: false,
      refusal: "field",
    })
  })
})
