import { readDeckId, traitWire } from "@airdesign/catalog"
import { Client, InMemoryTransport, fromJsonSchema, type JsonSchemaType } from "@modelcontextprotocol/client"
import { openDeck } from "@airdesign/engine"
import { Ajv2020 } from "ajv/dist/2020.js"
import { describe, expect, it } from "vitest"

import { createServer, emptyLog, memoryTurns } from "./index.js"

async function withClient(use: (client: Client) => Promise<void>): Promise<void> {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const deck = openDeck(id.deck)
  const server = createServer({
    caller: { actor: "agent", runId: "run" },
    deck,
    log: emptyLog(),
    now: 0,
    turns: memoryTurns(),
  })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    await use(client)
  } finally {
    await client.close()
    await server.close()
  }
}

describe("the listed tool schemas", () => {
  it("lists each input schema as valid JSON Schema 2020-12 whose references resolve inside it", async () => {
    await withClient(async (client) => {
      const { tools } = await client.listTools()
      const dialect = "https://json-schema.org/draft/2020-12/schema"
      const references = (value: unknown): readonly string[] => {
        if (Array.isArray(value)) return value.flatMap(references)
        if (typeof value !== "object" || value === null) return []
        return Object.entries(value).flatMap(([key, item]) =>
          key === "$ref" && typeof item === "string" ? [item] : references(item),
        )
      }
      const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true })
      for (const { name, inputSchema } of tools) {
        expect(inputSchema.$schema ?? dialect, name).toBe(dialect)
        expect(ajv.validateSchema(inputSchema), `${name}: ${ajv.errorsText()}`).toBe(true)
        expect(
          references(inputSchema).filter((target) => !target.startsWith("#/$defs/")),
          name,
        ).toEqual([])
        expect(() => ajv.compile(inputSchema), name).not.toThrow()
      }
    })
  })

  it("validates shared trait fields with the MCP client's JSON Schema dialect", async () => {
    await withClient(async (client) => {
      const { tools } = await client.listTools()
      const edit = tools.find((tool) => tool.name === "airdesign_edit_deck")
      if (edit === undefined) throw new Error("missing edit")
      expect(edit.inputSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema")
      const schema = fromJsonSchema(edit.inputSchema as JsonSchemaType)
      for (const trait of Object.values(traitWire)) {
        for (const { example } of Object.values(trait.fields)) {
          const input = { deck: "deck", base: 0, changes: [{ op: "set", target: "258.7", ...example }] }
          expect((await schema["~standard"].validate(input)).issues, JSON.stringify(example)).toBeUndefined()
        }
      }
      const invalid = {
        deck: "deck",
        base: 0,
        changes: [{ op: "set", target: "258.7", border: { head: { type: "bogus", width: "sm", length: "sm" } } }],
      }
      expect((await schema["~standard"].validate(invalid)).issues?.length).toBeGreaterThan(0)
    })
  })
})
