import { describe, expect, it } from "vitest"
import { advertisedSchema } from "./advertised-schema.js"
import { colorPattern } from "./agent-color.js"
import { toolInputSchema } from "./catalog.js"

const color = { type: "string", pattern: `^${colorPattern}$` }
const paint = {
  type: ["string", "object"],
  pattern: `^(?:none|${colorPattern}|group)$`,
  properties: { pattern: { type: "string", enum: ["dkDnDiag"] }, solid: color },
  additionalProperties: false,
  maxProperties: 1,
  minProperties: 1,
  description: "Color, none or group.",
}

describe("the schema an agent is shown", () => {
  it("drops the limits only a reader meets and keeps every type, choice, range and closed object", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["deck", "changes"],
      properties: {
        deck: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" },
        base: { type: "integer", minimum: 0, maximum: 9007199254740991 },
        changes: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "object",
            additionalProperties: false,
            minProperties: 3,
            properties: {
              name: { type: "string", maxLength: 200 },
              notes: {
                type: "string",
                pattern:
                  "^(?![\\s\\S]*(?:\\u0000|[\\ud800-\\udbff](?![\\udc00-\\udfff])|(?<![\\ud800-\\udbff])[\\udc00-\\udfff]))[\\s\\S]*$",
              },
              width: { type: "number", minimum: 0, maximum: 1584 },
              labels: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
              guides: { type: "array", items: { type: "number" }, maxItems: 200, uniqueItems: true },
              adjust: {
                type: "object",
                additionalProperties: { type: "integer", minimum: -2147483647 },
                maxProperties: 8,
              },
              color,
              paint,
            },
          },
        },
      },
    }
    expect(advertisedSchema(schema)).toEqual({
      type: "object",
      additionalProperties: false,
      required: ["deck", "changes"],
      properties: {
        deck: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" },
        base: { type: "integer", minimum: 0 },
        changes: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              notes: { type: "string" },
              width: { type: "number", minimum: 0, maximum: 1584 },
              labels: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
              guides: { type: "array", items: { type: "number" } },
              adjust: { type: "object", additionalProperties: { type: "integer" } },
              color,
              paint: {
                type: ["string", "object"],
                properties: { pattern: { type: "string", enum: ["dkDnDiag"] }, solid: color },
                additionalProperties: false,
                maxProperties: 1,
                description: "Color, none or group.",
              },
            },
          },
        },
      },
    })
  })

  it("shows airdesign_edit_deck with no length caps, the cap on changes an agent can meet, and each colour and layer id once", () => {
    const shown = JSON.stringify(toolInputSchema("edit_deck"))
    expect(shown).not.toContain('"maxLength"')
    expect(shown).not.toContain('"minProperties"')
    expect(shown).toContain('"maxItems":100')
    expect(shown.split("accent[1-6]").length - 1).toBe(1)
    expect(shown.split('"^[a-z0-9]{1,16}:[0-9]{1,12}$"').length - 1).toBe(1)
  })
})
