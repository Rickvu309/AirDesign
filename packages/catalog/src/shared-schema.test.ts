import { describe, expect, it } from "vitest"
import * as z from "zod/v4"
import { agentSchema } from "./agent-form.js"
import { catalog, toolInputSchema } from "./catalog.js"
import { inlinedSchema, sharedSchemas } from "./shared-schema.js"
import { traitWire } from "./trait-wire.js"

const color = agentSchema({ kind: "color" })

function references(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(references)
  if (typeof value !== "object" || value === null) return []
  return Object.entries(value).flatMap(([key, item]) =>
    key === "$ref" && typeof item === "string" ? [item] : references(item),
  )
}

describe("a tool's input schema says each repeated subschema once", () => {
  it("moves a subschema used twice into $defs, named by the key that holds it most, and refers to it", () => {
    const schema = {
      type: "object",
      properties: {
        shadow: { type: "object", description: "Shadow", properties: { color } },
        glow: { type: "object", description: "Glow", properties: { color, radius: { type: "number" } } },
        fill: { type: "object", properties: { solid: color } },
      },
    }
    expect(sharedSchemas(schema)).toEqual({
      type: "object",
      properties: {
        shadow: { type: "object", description: "Shadow", properties: { color: { $ref: "#/$defs/color" } } },
        glow: {
          type: "object",
          description: "Glow",
          properties: { color: { $ref: "#/$defs/color" }, radius: { type: "number" } },
        },
        fill: { type: "object", properties: { solid: { $ref: "#/$defs/color" } } },
      },
      $defs: { color },
    })
  })

  it("shares a subschema that repeats under different descriptions, and keeps each description beside its reference", () => {
    const arrow = {
      type: "object",
      required: ["type", "width", "length"],
      properties: {
        type: { type: "string", enum: ["none", "triangle", "stealth"] },
        width: { type: "string", enum: ["sm", "med", "lg"] },
        length: { type: "string", enum: ["sm", "med", "lg"] },
      },
    }
    const schema = {
      type: "object",
      properties: {
        head: { ...arrow, description: "The arrowhead at the start." },
        tail: { ...arrow, description: "The arrowhead at the end." },
      },
    }
    expect(sharedSchemas(schema)).toEqual({
      type: "object",
      properties: {
        head: { $ref: "#/$defs/head", description: "The arrowhead at the start." },
        tail: { $ref: "#/$defs/head", description: "The arrowhead at the end." },
      },
      $defs: { head: arrow },
    })
    expect(inlinedSchema(sharedSchemas(schema))).toEqual(schema)
  })

  it("shares a small subschema when that makes the schema shorter, and leaves one that would not", () => {
    const points = { type: "number", minimum: 0, maximum: 4032 }
    const flag = { type: "boolean" }
    const schema = {
      type: "object",
      properties: { w: points, h: points, gap: points, size: points, hidden: flag, locked: flag },
    }
    const shared = sharedSchemas(schema)
    expect(shared).toEqual({
      type: "object",
      properties: {
        w: { $ref: "#/$defs/gap" },
        h: { $ref: "#/$defs/gap" },
        gap: { $ref: "#/$defs/gap" },
        size: { $ref: "#/$defs/gap" },
        hidden: flag,
        locked: flag,
      },
      $defs: { gap: points },
    })
    expect(JSON.stringify(shared).length).toBeLessThan(JSON.stringify(schema).length)
    expect(inlinedSchema(shared)).toEqual(schema)
  })

  it("says a description that several uses share once, in the shared subschema, and keeps a different one beside its reference", () => {
    const slide = { type: "string", pattern: "^(?:[0-9]{1,10}|n[0-9a-z]{12})$" }
    const named = { ...slide, description: "Slide id from airdesign_read_deck." }
    const schema = {
      type: "object",
      properties: {
        slide: named,
        start: named,
        stop: named,
        template: { ...slide, description: "Its template's slide." },
      },
    }
    const shared = sharedSchemas(schema)
    expect(shared).toEqual({
      type: "object",
      properties: {
        slide: { $ref: "#/$defs/slide" },
        start: { $ref: "#/$defs/slide" },
        stop: { $ref: "#/$defs/slide" },
        template: { $ref: "#/$defs/slide", description: "Its template's slide." },
      },
      $defs: { slide: named },
    })
    expect(inlinedSchema(shared)).toEqual(schema)
  })

  it("leaves a schema with nothing repeated as it is, and never shares a properties map", () => {
    const schema = { type: "object", properties: { one: color } }
    expect(sharedSchemas(schema)).toBe(schema)
    const twice = { type: "object", properties: { a: { type: "object", properties: { x: color } } } }
    expect(references(sharedSchemas(twice))).toEqual([])
  })

  it("resolves every reference in airdesign_edit_deck, and still takes every field's example", () => {
    const schema = toolInputSchema("edit_deck")
    const defs = Object.keys((schema as { readonly $defs?: object }).$defs ?? {})
    expect(defs).toContain("color")
    for (const reference of references(schema)) expect(defs).toContain(reference.replace("#/$defs/", ""))
    const check = z.fromJSONSchema(schema)
    for (const trait of Object.values(traitWire)) {
      for (const { example } of Object.values(trait.fields as Readonly<Record<string, { readonly example: object }>>)) {
        const change = { op: "set", target: "258.2", ...example }
        expect(check.safeParse({ deck: "d", base: 0, changes: [change] }).success, JSON.stringify(example)).toBe(true)
      }
    }
    const icon = { op: "add", kind: "shape", slide: "258", icon: "rocket" }
    expect(check.safeParse({ deck: "d", base: 0, changes: [icon] }).success).toBe(true)
    const wrong = { op: "set", target: "258.2", effects: { glow: { halo: { radius: 8, color: "accent9" } } } }
    expect(check.safeParse({ deck: "d", base: 0, changes: [wrong] }).success).toBe(false)
  })
})

describe("a schema for a caller that may not follow references", () => {
  it("names the opening text carried by the legacy floor field", () => {
    expect(inlinedSchema(toolInputSchema("edit_deck"))).toMatchObject({
      properties: {
        changes: {
          items: {
            anyOf: expect.arrayContaining([
              expect.objectContaining({
                properties: expect.objectContaining({
                  floor: expect.objectContaining({ description: "Opening text of the layer." }),
                }),
              }),
            ]),
          },
        },
      },
    })
  })

  it("puts each shared subschema back where it was used, keeps the words beside a reference, and drops $defs", () => {
    const leaf = { type: "string", pattern: "^[a-z]+$" }
    const pair = { type: "object", properties: { left: { $ref: "#/$defs/leaf" }, right: { $ref: "#/$defs/leaf" } } }
    const schema = {
      type: "object",
      properties: {
        first: { $ref: "#/$defs/pair" },
        second: { $ref: "#/$defs/leaf", description: "A name." },
      },
      $defs: { leaf, pair },
    }
    expect(inlinedSchema(schema)).toEqual({
      type: "object",
      properties: {
        first: { type: "object", properties: { left: leaf, right: leaf } },
        second: { ...leaf, description: "A name." },
      },
    })
  })

  it("gives back every tool's input schema as zod wrote it, with no reference left", () => {
    for (const op of ["edit_deck", "read_deck"] as const) {
      const inlined = inlinedSchema(toolInputSchema(op))
      expect(references(inlined)).toEqual([])
      expect(inlined).not.toHaveProperty("$defs")
      expect(inlined).toEqual(z.toJSONSchema(catalog[op].read.input, { io: "input" }))
    }
  })
})
