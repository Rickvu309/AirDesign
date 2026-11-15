import { describe, expect, it } from "vitest"
import { catalog, projectTools, toolInputSchema } from "./index.js"

describe("run operations in the catalog", () => {
  it("keeps start_run and undo_run from agents and offers stop_run on the server", () => {
    expect(catalog.start_run).toEqual({ kind: "command", exposure: "web" })
    expect(catalog.stop_run).toMatchObject({ kind: "command", exposure: "agent", runsOn: "server" })
    expect(catalog.undo_run).toEqual({ kind: "command", exposure: "web" })
    expect(catalog.list_decks).toMatchObject({ kind: "query", exposure: "agent", runsOn: "server" })
    expect(catalog.read_deck).toMatchObject({ kind: "query", exposure: "agent", runsOn: "server" })
    expect(projectTools(catalog).map((tool) => tool.op)).toEqual([
      "add_slide",
      "add_text_box",
      "delete_element",
      "delete_slide",
      "duplicate_slide",
      "edit_deck",
      "list_decks",
      "move_slide",
      "read_deck",
      "stop_run",
    ])
  })
})

describe("projectTools", () => {
  it("projects the agent tools in name order", () => {
    const tools = projectTools(catalog)
    expect(tools).toHaveLength(10)
    expect(tools.map((tool) => tool.name)).toEqual([
      "airdesign_add_slide",
      "airdesign_add_text_box",
      "airdesign_delete_element",
      "airdesign_delete_slide",
      "airdesign_duplicate_slide",
      "airdesign_edit_deck",
      "airdesign_list_decks",
      "airdesign_move_slide",
      "airdesign_read_deck",
      "airdesign_stop_run",
    ])
    expect(tools.every((tool) => tool.runsOn === "server")).toBe(true)
    expect(tools.find((tool) => tool.op === "stop_run")?.destructiveHint).toBe(false)
    expect(tools.find((tool) => tool.op === "stop_run")?.description).toContain("when your turn is finished")
    expect(tools.find((tool) => tool.op === "stop_run")?.description).toContain("closing elements")
    expect(tools.every((tool) => tool.openWorldHint === false)).toBe(true)
    const edit = tools.find((tool) => tool.name === "airdesign_edit_deck")
    expect(edit).toEqual({
      name: "airdesign_edit_deck",
      op: "edit_deck",
      description:
        "Write values on one deck. Read it first with airdesign_read_deck and send that revision as base and each element's version as readAt; a change with op needs no readAt. The server names the actor. Each answer carries the runId of your turn. Call airdesign_stop_run with it when your turn is finished.",
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
        "Read one deck this account owns. Send revision as base to airdesign_edit_deck and each element's version as readAt. slides lists slide ids in position order. Indexed elements include node, slide, kind, opening or edited value and box, and version (0 before edits). role names a placeholder. design is one line of the element's look, as the instructions say. closed means a person's newer edit or another run holds it. grouped elements refuse box edits. index is ready, pending, or missing; pending or missing means the owner must open the deck in AirDesign to finish indexing. Send slide or cursor to read the rest.",
      runsOn: "server",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
    expect(tools.find((tool) => tool.name === "airdesign_list_decks")).toEqual({
      name: "airdesign_list_decks",
      op: "list_decks",
      description:
        "List the decks this account owns. Each row has the deck id, its name, and trash when the deck is in Trash.",
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

describe("element tools", () => {
  it("reads a text box with an optional box and text, and a delete with an element id", () => {
    const add = catalog.add_text_box.read
    const base = { deck: "d", base: 3, slide: "258" }
    expect(add(base).ok).toBe(true)
    expect(add({ ...base, text: "Hello", box: { x: 0, y: 0, cx: 10, cy: 10 } }).ok).toBe(true)
    expect(add({ ...base, box: { x: 0, y: 0, cx: 0, cy: 10 } }).ok).toBe(false)
    expect(add({ ...base, box: { x: 0, y: 0, cx: 10 } }).ok).toBe(false)
    expect(add({ ...base, slide: "x" }).ok).toBe(false)
    expect(add({ ...base, more: 1 }).ok).toBe(false)
    const remove = catalog.delete_element.read
    expect(remove({ deck: "d", base: 3, node: "258.7" }).ok).toBe(true)
    expect(remove({ deck: "d", base: 3, node: "258" }).ok).toBe(false)
  })

  it("states the units and the free area in the schema", () => {
    const schema = JSON.stringify(toolInputSchema("add_text_box"))
    expect(schema).toContain("914400 EMU")
    expect(schema).toContain("largest free area")
  })
})
