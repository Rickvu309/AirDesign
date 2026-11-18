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
    expect(tools.every((tool) => tool.openWorldHint === false)).toBe(true)
    const edit = tools.find((tool) => tool.name === "airdesign_edit_deck")
    expect(edit).toEqual({
      name: "airdesign_edit_deck",
      op: "edit_deck",
      description:
        "Change one deck: text, boxes, looks, layers and slides, all landing or none. Read it first with airdesign_read_deck and send that revision as base and each layer's version as readAt; a change with op needs no readAt. Each answer carries the runId of your turn. Call airdesign_stop_run with it when your turn is finished.",
      runsOn: "server",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    })
    expect(tools.find((tool) => tool.name === "airdesign_read_deck")).toEqual({
      name: "airdesign_read_deck",
      op: "read_deck",
      description:
        "Read one deck this account owns. slides lists slide ids in position order. Every page includes groups, each slide group's first slide id; a slide group exports as a PowerPoint section. Added, duplicated and moved slides join their anchor's slide group. Indexed layers include node (layer id), slide, kind, opening or changed value and box, and version (0 before any change). role names a placeholder. design is one line of the layer's look, as the instructions say. closed means a person's newer change or another run holds it. grouped layers refuse box changes. index is ready, pending, or missing; pending or missing means the owner must open the deck in AirDesign to finish indexing. Send slide or cursor to read the rest.",
      runsOn: "server",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
    expect(tools.find((tool) => tool.name === "airdesign_list_decks")).toEqual({
      name: "airdesign_list_decks",
      op: "list_decks",
      description: "List the decks this account owns, each with its id, its name, and trash when it is in Trash.",
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
