import { describe, expect, it } from "vitest"
import { catalog, projectTools, toolInputSchema } from "./index.js"

describe("run operations in the catalog", () => {
  it("keeps start_run and undo_run from agents and offers stop_run on the server", () => {
    expect(catalog.start_run).toEqual({ kind: "command", exposure: "web" })
    expect(catalog.stop_run).toMatchObject({ kind: "command", exposure: "agent", runsOn: "server" })
    expect(catalog.undo_run).toEqual({ kind: "command", exposure: "web" })
    expect(catalog.list_decks).toMatchObject({ kind: "query", exposure: "agent", runsOn: "server" })
    expect(catalog.read_deck).toMatchObject({ kind: "query", exposure: "agent", runsOn: "server" })
    expect(catalog.create_deck).toMatchObject({ kind: "command", exposure: "agent", runsOn: "server" })
    expect(projectTools(catalog).map((tool) => tool.op)).toEqual([
      "create_deck",
      "edit_deck",
      "list_decks",
      "read_deck",
      "stop_run",
    ])
  })
})

describe("projectTools", () => {
  it("projects the agent tools in name order", () => {
    const tools = projectTools(catalog)
    expect(tools).toHaveLength(5)
    expect(tools.map((tool) => tool.name)).toEqual([
      "airdesign_create_deck",
      "airdesign_edit_deck",
      "airdesign_list_decks",
      "airdesign_read_deck",
      "airdesign_stop_run",
    ])
    expect(tools.every((tool) => tool.runsOn === "server")).toBe(true)
    expect(tools.find((tool) => tool.op === "stop_run")?.destructiveHint).toBe(false)
    expect(tools.find((tool) => tool.op === "stop_run")?.description).toContain("when your turn is finished")
    expect(tools.find((tool) => tool.op === "stop_run")?.description).toContain("closing layers")
    expect(tools.filter((tool) => tool.openWorldHint).map((tool) => tool.name)).toEqual(["airdesign_edit_deck"])
    const edit = tools.find((tool) => tool.name === "airdesign_edit_deck")
    expect(edit).toEqual({
      name: "airdesign_edit_deck",
      op: "edit_deck",
      description:
        "Change the deck, all of it landing or none. Send airdesign_read_deck's rev as base. The answer has the new rev, the ids of the layers and slides you added, and a runId: send it with your next edits and to airdesign_stop_run when done.",
      runsOn: "server",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    })
    expect(tools.find((tool) => tool.name === "airdesign_read_deck")).toEqual({
      name: "airdesign_read_deck",
      op: "read_deck",
      description:
        "Read an owned deck, one line for each layer: its id, what it is, @x,y and size, then its look. rev is the base to send to airdesign_edit_deck. Send slide or cursor to read the rest.",
      runsOn: "server",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
    expect(tools.find((tool) => tool.name === "airdesign_list_decks")).toEqual({
      name: "airdesign_list_decks",
      op: "list_decks",
      description: "List owned decks with id, name and rev.",
      runsOn: "server",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
  })

  it("gives every agent tool the JSON schema of its reader, a closed object that names its fields", () => {
    for (const tool of projectTools(catalog)) {
      expect(toolInputSchema(tool.op)).toMatchObject({ type: "object", additionalProperties: false })
    }
    expect(toolInputSchema("stop_run")).toMatchObject({
      properties: { deck: { type: "string" }, runId: { type: "string" } },
      required: ["deck", "runId"],
    })
  })

  it("builds each tool's JSON schema once, since the MCP server is built again for every request", () => {
    for (const tool of projectTools(catalog)) expect(toolInputSchema(tool.op)).toBe(toolInputSchema(tool.op))
  })

  it("omits a web row", () => {
    expect(
      projectTools({ commit_edits: { kind: "command", exposure: "web", runsOn: "server", description: "x" } }),
    ).toEqual([])
  })

  it("throws when an agent row omits where it runs", () => {
    expect(() => projectTools({ bad: { kind: "command", exposure: "agent", description: "x" } as never })).toThrow(
      "agent tool bad must say where it runs",
    )
  })
})

it("reads the scene's changes through edit_deck", () => {
  const read = catalog.edit_deck.read
  const base = { deck: "d", base: 3 }
  expect(read({ ...base, changes: [{ op: "add", kind: "text", slide: "s:3" }] }).ok).toBe(true)
  expect(read({ ...base, runId: "r1", changes: [{ op: "delete", nodes: ["s:4"] }] }).ok).toBe(true)
  expect(read({ ...base, changes: [] })).toEqual({ ok: false, refusal: "batch" })
  expect(read({ deck: "d", changes: [{}] })).toEqual({ ok: false, refusal: "base" })
  expect(read({ ...base, changes: [{}], actor: "person" })).toEqual({ ok: false, refusal: "field" })
})
