import { describe, expect, it } from "vitest"
import * as z from "zod/v4"
import { agentSchema } from "./agent-form.js"
import { toolInputSchema } from "./catalog.js"
import { sharedSchemas } from "./shared-schema.js"
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
        glow: { type: "object", description: "Glow", properties: { color } },
        fill: { type: "object", properties: { solid: color } },
      },
    }
    expect(sharedSchemas(schema)).toEqual({
      type: "object",
      properties: {
        shadow: { type: "object", description: "Shadow", properties: { color: { $ref: "#/$defs/color" } } },
        glow: { type: "object", description: "Glow", properties: { color: { $ref: "#/$defs/color" } } },
        fill: { type: "object", properties: { solid: { $ref: "#/$defs/color" } } },
      },
      $defs: { color },
    })
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
    const icon = { op: "add", kind: "picture", slide: "258", icon: "rocket" }
    expect(check.safeParse({ deck: "d", base: 0, changes: [icon] }).success).toBe(true)
    const wrong = { op: "set", target: "258.2", effects: { glow: { halo: { radius: 8, color: "accent9" } } } }
    expect(check.safeParse({ deck: "d", base: 0, changes: [wrong] }).success).toBe(false)
  })
})
