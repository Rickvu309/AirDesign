import { describe, expect, it } from "vitest"
import { catalog, projectTools, toolInputSchema } from "./index.js"

describe("run operations in the catalog", () => {
  it("keeps start_run from agents and offers stop_run and undo_run on the server", () => {
    expect(catalog.start_run).toEqual({ kind: "command", exposure: "web" })
    expect(catalog.stop_run).toMatchObject({ kind: "command", exposure: "agent", runsOn: "server" })
    expect(catalog.undo_run).toMatchObject({ kind: "command", exposure: "agent", runsOn: "server" })
    expect(catalog.get_app_state).toMatchObject({ kind: "query", exposure: "agent", runsOn: "server" })
    expect(catalog.execute).toMatchObject({ kind: "command", exposure: "agent", runsOn: "server" })
    expect(projectTools(catalog).map((tool) => tool.op)).toEqual([
      "execute",
      "get_app_state",
      "get_style",
      "read_skill",
      "stop_run",
      "undo_run",
    ])
  })
})

describe("projectTools", () => {
  it("projects the agent tools in name order", () => {
    const tools = projectTools(catalog)
    expect(tools).toHaveLength(6)
    expect(tools.map((tool) => tool.name)).toEqual([
      "airdesign_execute",
      "airdesign_get_app_state",
      "airdesign_get_style",
      "airdesign_read_skill",
      "airdesign_stop_run",
      "airdesign_undo_run",
    ])
    expect(tools.every((tool) => tool.runsOn === "server")).toBe(true)
    expect(tools.find((tool) => tool.op === "stop_run")?.destructiveHint).toBe(false)
    expect(tools.find((tool) => tool.op === "stop_run")?.description).toContain("when your run is finished")
    expect(tools.find((tool) => tool.op === "stop_run")?.description).toContain("closing layers")
    expect(tools.filter((tool) => tool.openWorldHint).map((tool) => tool.name)).toEqual(["airdesign_execute"])
    expect(tools.find((tool) => tool.name === "airdesign_execute")).toMatchObject({
      op: "execute",
      runsOn: "server",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    })
    expect(tools.find((tool) => tool.name === "airdesign_execute")?.description).toMatch(
      /one undo step\. Read airdesign_read_skill with name "execute"/,
    )
    expect(tools.find((tool) => tool.name === "airdesign_get_app_state")).toEqual({
      name: "airdesign_get_app_state",
      op: "get_app_state",
      description: "List your decks and see the deck and selection in an open tab.",
      runsOn: "server",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
  })

  it("describes guides, runs and edits with the agent's glossary words", () => {
    const tools = projectTools(catalog)
    expect(tools.find((tool) => tool.op === "read_skill")?.description).toContain("guide")
    expect(tools.find((tool) => tool.op === "stop_run")?.description).toContain("a person's edits")
    for (const tool of tools) {
      expect(tool.description, tool.name).not.toMatch(/\b(?:skills?|turns?|changes?)\b/i)
    }
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

it("reads an execute call: a deck, a script up to 100,000 characters and an optional run", () => {
  const read = catalog.execute.read
  expect(read({ deck: "d", script: "get()" })).toEqual({ ok: true, deck: "d", script: "get()" })
  expect(read({ deck: "d", script: "get()", runId: "r1" }).ok).toBe(true)
  expect(read({ deck: "d", script: "x".repeat(100_000) }).ok).toBe(true)
  expect(read({ deck: "d", script: "x".repeat(100_001) })).toEqual({
    ok: false,
    refusal: "field",
    field: "script",
    fault: "form",
    form: "JavaScript, 1 to 100,000 characters.",
  })
  expect(read({ deck: "d" })).toEqual({
    ok: false,
    refusal: "field",
    field: "script",
    fault: "missing",
    form: "JavaScript, 1 to 100,000 characters.",
  })
  expect(read({ deck: "d", script: "", base: 3 })).toEqual({
    ok: false,
    refusal: "field",
    field: "base",
    fault: "unknown",
    form: "One of deck, script, runId.",
  })
  expect(read({ deck: "d", script: "1", runId: "bad id!" })).toEqual({
    ok: false,
    refusal: "field",
    field: "runId",
    fault: "form",
    form: "The runId a call answered: 1 to 64 of letters, digits, _ or -.",
  })
  expect(read({ deck: "bad id!", script: "1" })).toEqual({ ok: false, refusal: "deck" })
})
