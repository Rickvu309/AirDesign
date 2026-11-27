import { themePresetById, themePresets } from "@airdesign/skills"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { bytesOf } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { readSkillIndex } from "@airdesign/skills"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"

import { createServer, emptyLog, type Host, type Session } from "./index.js"
import { getStyleTool } from "./skill-tools.js"
import { memoryDecks } from "./testing/memory-decks.js"

function started(): doom.Doom {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Title",
        children: [
          { type: "shape", name: "Title", props: { role: "title", text: doom.textFromMarkdown("Untitled", "title") } },
        ],
      },
    ],
  }).doom
}

function sessionFor(): Session {
  let minted = 0
  return { agent: "aira", mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
}

async function withClient(session: Session, host: Host, use: (client: Client) => Promise<void>): Promise<void> {
  const server = createServer(session, host)
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

const textOf = (result: { content: unknown }) =>
  (result.content as { type: string; text?: string }[]).filter((block) => block.type === "text")

describe("airdesign_read_skill and airdesign_get_style", () => {
  it("lists both tools as read-only and adds under 400 tokens to the advertised listing", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const { tools } = await client.listTools()
      const names = tools.map((tool) => tool.name)
      expect(names).toContain("airdesign_read_skill")
      expect(names).toContain("airdesign_get_style")

      const advertised = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      }))
      const added = advertised.filter(
        (tool) => tool.name === "airdesign_read_skill" || tool.name === "airdesign_get_style",
      )
      const rest = advertised.filter(
        (tool) => tool.name !== "airdesign_read_skill" && tool.name !== "airdesign_get_style",
      )
      const beforeTokens = Math.ceil(bytesOf(JSON.stringify(rest)) / 4)
      const afterTokens = Math.ceil(bytesOf(JSON.stringify(advertised)) / 4)
      expect(afterTokens - beforeTokens).toBeLessThan(400)

      for (const tool of added) {
        expect(tool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        })
      }
      expect(tools.every((tool) => !Object.hasOwn(tool, "outputSchema"))).toBe(true)
    })
  })

  it("returns the skill index with no name and opens every skill named in it", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const indexResult = await client.callTool({ name: "airdesign_read_skill", arguments: {} })
      expect(indexResult.isError).not.toBe(true)
      expect(textOf(indexResult)).toEqual([{ type: "text", text: JSON.stringify(indexResult.structuredContent) }])

      const index = indexResult.structuredContent as {
        ok: boolean
        skills: { name: string; when: string }[]
        text: string
        note: string
      }
      expect(index.ok).toBe(true)
      expect(index.skills.length).toBeGreaterThan(0)
      expect(index.skills.map((skill) => skill.name)).toContain("execute")
      expect(index.text).toContain("execute")
      expect(index.note).toContain("airdesign_read_skill")

      for (const entry of index.skills) {
        expect(entry.when.trim().length).toBeGreaterThan(0)
        const opened = await client.callTool({ name: "airdesign_read_skill", arguments: { name: entry.name } })
        expect(opened.isError).not.toBe(true)
        expect(textOf(opened)).toEqual([{ type: "text", text: JSON.stringify(opened.structuredContent) }])
        const skill = opened.structuredContent as { ok: boolean; name: string; text: string; note: string }
        expect(skill.ok).toBe(true)
        expect(skill.name).toBe(entry.name)
        expect(skill.text.trim().length).toBeGreaterThan(0)
      }

      const executeSkill = (await client.callTool({ name: "airdesign_read_skill", arguments: { name: "execute" } }))
        .structuredContent as { text: string }
      expect(executeSkill.text).toContain("airdesign_execute")
      for (const verb of [
        "insert",
        "update",
        "replace",
        "copy",
        "move",
        "remove",
        "group",
        "ungroup",
        "variables",
        "get",
        "screenshot",
        "print",
      ])
        expect(executeSkill.text).toContain(`\`${verb}(`)
    })
  })

  it("refuses unknown skill names, traversal paths and malformed input with structuredContent", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const missing = await client.callTool({ name: "airdesign_read_skill", arguments: { name: "does-not-exist" } })
      expect(missing.isError).toBe(true)
      expect(missing.structuredContent).toMatchObject({
        ok: false,
        refusal: "field",
        field: "name",
        available: readSkillIndex().skills.map((entry) => entry.name),
      })
      expect(textOf(missing)).toEqual([{ type: "text", text: JSON.stringify(missing.structuredContent) }])

      const traversal = await client.callTool({ name: "airdesign_read_skill", arguments: { name: "../package.json" } })
      expect(traversal.isError).toBe(true)
      expect(traversal.structuredContent).toMatchObject({ ok: false, refusal: "field" })

      const extra = await client.callTool({ name: "airdesign_read_skill", arguments: { extra: "nope" } })
      expect(extra.isError).toBe(true)
      expect(extra.structuredContent).toMatchObject({ ok: false, refusal: "field", field: "extra", fault: "unknown" })

      const wrongType = await client.callTool({ name: "airdesign_read_skill", arguments: { name: 42 } })
      expect(wrongType.isError).toBe(true)
      expect(wrongType.structuredContent).toMatchObject({ ok: false, refusal: "field", field: "name", fault: "form" })
    })
  })

  it("serves one style for every library theme, each naming only that theme's colours and text styles", async () => {
    const themeIds = themePresets.map(({ id }) => id).sort()
    const sections = ["Identity", "Layout", "Token map", "Decoration", "Hierarchy", "Typography", "Parameters"]
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const listed = await client.callTool({ name: "airdesign_get_style", arguments: {} })
      expect(listed.isError).not.toBe(true)
      const styles = (listed.structuredContent as { styles: { name: string; summary: string }[] }).styles
      expect(styles.map((style) => style.name)).toEqual(themeIds)

      for (const id of themeIds) {
        const theme = themePresetById(id)!.theme
        const known = new Set([...Object.keys(theme.colors), ...Object.keys(theme.textStyles), "heading", "body"])
        const opened = await client.callTool({ name: "airdesign_get_style", arguments: { name: id } })
        expect(opened.isError).not.toBe(true)
        const answer = opened.structuredContent as { text: string; parameters: unknown[] }
        expect(answer.parameters.length).toBeGreaterThan(0)
        expect(answer.text.match(/^## .+$/gm)).toEqual(sections.map((section) => `## ${section}`))
        const tokenMap = answer.text.split("## Token map")[1]!.split("\n## ")[0]!
        const named = [...tokenMap.matchAll(/`([a-zA-Z0-9]+)(?:[+-]\d+)?`/g)].map((match) => match[1]!)
        expect(named.length).toBeGreaterThan(0)
        expect(named.filter((name) => !known.has(name))).toEqual([])
      }

      const missing = await client.callTool({ name: "airdesign_get_style", arguments: { name: "editorial-dark" } })
      expect(missing.isError).toBe(true)
      expect(missing.structuredContent).toMatchObject({
        ok: false,
        refusal: "field",
        field: "name",
        available: themeIds,
      })
    })
  })

  it("checks host admission on skill and style tool calls", async () => {
    const text = "Ninety tool calls in five minutes. The next tool call can run in 12 seconds." as const
    let calls = 0
    const host: Host = {
      ...memoryDecks(started),
      admit: async () => {
        calls += 1
        return { ok: false, log: emptyLog(), text, resetsAt: 5_000 }
      },
    }
    await withClient(sessionFor(), host, async (client) => {
      const skill = await client.callTool({ name: "airdesign_read_skill", arguments: {} })
      expect(skill.isError).toBe(true)
      expect(skill.structuredContent).toEqual({ ok: false, refusal: "rate", note: text })

      const style = await client.callTool({ name: "airdesign_get_style", arguments: {} })
      expect(style.isError).toBe(true)
      expect(style.structuredContent).toEqual({ ok: false, refusal: "rate", note: text })
    })
    expect(calls).toBe(2)
  })

  it("lists styles and returns style text and parameters when styles exist", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "airdesign-mcp-styles-"))
    try {
      const stylesDir = path.join(root, "styles")
      mkdirSync(stylesDir, { recursive: true })
      writeFileSync(
        path.join(stylesDir, "editorial.md"),
        [
          "# Editorial",
          "",
          "Calm editorial layout with strong serif headlines.",
          "",
          "## Parameters",
          "",
          "- `headingFont`: Heading font family",
          "- `accent`: Single accent colour",
          "",
        ].join("\n"),
      )

      const listed = getStyleTool({}, root)
      expect(listed.ok).toBe(true)
      expect(listed.answer).toEqual({
        ok: true,
        styles: [{ name: "editorial", summary: "Calm editorial layout with strong serif headlines." }],
        note: "Call airdesign_get_style with a style name to read its guide and parameters.",
      })

      const loaded = getStyleTool({ name: "editorial" }, root)
      expect(loaded.ok).toBe(true)
      expect(loaded.answer).toMatchObject({
        ok: true,
        name: "editorial",
        parameters: [
          { name: "headingFont", description: "Heading font family" },
          { name: "accent", description: "Single accent colour" },
        ],
        note: "Style editorial. Set its parameters before applying it to a deck.",
      })
      expect((loaded.answer as { text: string }).text).toContain("# Editorial")

      const missing = getStyleTool({ name: "nope" }, root)
      expect(missing.ok).toBe(false)
      expect(missing.answer).toMatchObject({
        ok: false,
        refusal: "field",
        field: "name",
        available: ["editorial"],
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
