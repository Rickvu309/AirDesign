import { describe, expect, it } from "vitest"
import { catalog, projectTools, toolInputSchema } from "./index.js"

describe("run operations in the catalog", () => {
  it("keeps start_run and undo_run from agents and offers stop_run on the server", () => {
    expect(catalog.start_run).toEqual({ kind: "command", exposure: "web" })
    expect(catalog.stop_run).toMatchObject({ kind: "command", exposure: "agent", runsOn: "server" })
    expect(catalog.undo_run).toEqual({ kind: "command", exposure: "web" })
    expect(catalog.list_decks).toMatchObject({ kind: "query", exposure: "agent", runsOn: "server" })
    expect(catalog.read_deck).toMatchObject({ kind: "query", exposure: "agent", runsOn: "server" })
    expect(projectTools(catalog).map((tool) => tool.op)).toEqual(["edit_deck", "list_decks", "read_deck", "stop_run"])
  })
})

describe("projectTools", () => {
  it("projects the agent tools in name order", () => {
    const tools = projectTools(catalog)
    expect(tools).toHaveLength(4)
    expect(tools.map((tool) => tool.name)).toEqual([
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
        "Edit text, boxes, design, layers or slides, all landing or none. Send airdesign_read_deck's revision as base and each layer's version as readAt (a change with op needs none). Pass the returned runId to airdesign_stop_run when done.",
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
        "Read an owned deck. slides lists slide ids in order; groups holds each slide group's first slide id (a PowerPoint section), which added, duplicated and moved slides join. A layer's node is its id, version 0 is unchanged, role names a placeholder, design is one line of its look, and closed means a person's newer change or another run holds it. A grouped layer's box is where it sits on the slide, and its group fits its layers; frame is auto or free. overflow marks text taller than its box, in points, with a size or height that fits. If index or findings is pending or missing, the owner must open the deck in AirDesign. Send slide or cursor to read the rest.",
      runsOn: "server",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
    expect(tools.find((tool) => tool.name === "airdesign_list_decks")).toEqual({
      name: "airdesign_list_decks",
      op: "list_decks",
      description: "List owned decks with id, name, and trash when in Trash.",
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

it("reads element changes through edit_deck", () => {
  const read = catalog.edit_deck.read
  const base = { deck: "d", base: 3 }
  expect(read({ ...base, changes: [{ op: "add", kind: "shape", slide: "258" }] }).ok).toBe(true)
  expect(read({ ...base, changes: [{ op: "delete", node: "258.7" }] }).ok).toBe(true)
  expect(read({ ...base, changes: [{ op: "delete", node: "258" }] }).ok).toBe(false)
})
