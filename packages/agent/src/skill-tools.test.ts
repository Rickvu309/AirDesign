import { themePresetById, themePresets } from "@airdesign/taste"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import * as doom from "@airdesign/doom"
import { skills } from "@airdesign/taste"
import { describe, expect, it } from "vitest"

import { callTool, type DeckHost, type Session } from "./index.js"
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
  return { agent: "aira", mint: () => `minted${String((minted += 1))}` }
}

describe("airdesign_read_skill and airdesign_get_style", () => {
  it("returns the skill index with no name and opens every skill named in it", async () => {
    const session = sessionFor()
    const host = memoryDecks(started)
    const indexResult = await callTool("airdesign_read_skill", {}, session, host)
    expect(indexResult.ok).toBe(true)

    const index = indexResult.fields as {
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
      const opened = await callTool("airdesign_read_skill", { name: entry.name }, session, host)
      expect(opened.ok).toBe(true)
      const skill = opened.fields as { ok: boolean; name: string; text: string; note: string }
      expect(skill.ok).toBe(true)
      expect(skill.name).toBe(entry.name)
      expect(skill.text.trim().length).toBeGreaterThan(0)
    }

    const executeSkill = (await callTool("airdesign_read_skill", { name: "execute" }, session, host)).fields as {
      text: string
    }
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

  it("refuses unknown skill names, traversal paths and malformed input with structuredContent", async () => {
    const session = sessionFor()
    const host = memoryDecks(started)
    const missing = await callTool("airdesign_read_skill", { name: "does-not-exist" }, session, host)
    expect(missing.ok).toBe(false)
    expect(missing.fields).toMatchObject({
      ok: false,
      refusal: "field",
      field: "name",
      available: skills().map((entry) => entry.name),
    })

    const traversal = await callTool("airdesign_read_skill", { name: "../package.json" }, session, host)
    expect(traversal.ok).toBe(false)
    expect(traversal.fields).toMatchObject({ ok: false, refusal: "field" })

    const extra = await callTool("airdesign_read_skill", { extra: "nope" }, session, host)
    expect(extra.ok).toBe(false)
    expect(extra.fields).toMatchObject({ ok: false, refusal: "field", field: "extra", fault: "unknown" })

    const wrongType = await callTool("airdesign_read_skill", { name: 42 }, session, host)
    expect(wrongType.ok).toBe(false)
    expect(wrongType.fields).toMatchObject({ ok: false, refusal: "field", field: "name", fault: "form" })
  })

  it("serves one style for every library theme, each naming only that theme's colours and text styles", async () => {
    const themeIds = themePresets.map(({ id }) => id).sort()
    const sections = ["Identity", "Layout", "Token map", "Decoration", "Hierarchy", "Typography", "Parameters"]
    const session = sessionFor()
    const host = memoryDecks(started)
    const listed = await callTool("airdesign_get_style", {}, session, host)
    expect(listed.ok).toBe(true)
    const styles = (listed.fields as { styles: { name: string; summary: string }[] }).styles
    expect(styles.map((style) => style.name)).toEqual(themeIds)

    for (const id of themeIds) {
      const theme = themePresetById(id)!.theme
      const known = new Set([...Object.keys(theme.colors), ...Object.keys(theme.textStyles), "heading", "body"])
      const opened = await callTool("airdesign_get_style", { name: id }, session, host)
      expect(opened.ok).toBe(true)
      const answer = opened.fields as { text: string; parameters: unknown[] }
      expect(answer.parameters.length).toBeGreaterThan(0)
      expect(answer.text.match(/^## .+$/gm)).toEqual(sections.map((section) => `## ${section}`))
      const tokenMap = answer.text.split("## Token map")[1]!.split("\n## ")[0]!
      const named = [...tokenMap.matchAll(/`([a-zA-Z0-9]+)(?:[+-]\d+)?`/g)].map((match) => match[1]!)
      expect(named.length).toBeGreaterThan(0)
      expect(named.filter((name) => !known.has(name))).toEqual([])
    }

    const missing = await callTool("airdesign_get_style", { name: "editorial-dark" }, session, host)
    expect(missing.ok).toBe(false)
    expect(missing.fields).toMatchObject({
      ok: false,
      refusal: "field",
      field: "name",
      available: themeIds,
    })
  })

  it("checks host admission on skill and style tool calls", async () => {
    const text = "Ninety tool calls in five minutes. The next tool call can run in 12 seconds."
    let calls = 0
    const host: DeckHost = {
      ...memoryDecks(started),
      admit: async () => {
        calls += 1
        return { ok: false, text }
      },
    }
    const session = sessionFor()
    const skill = await callTool("airdesign_read_skill", {}, session, host)
    expect(skill.ok).toBe(false)
    expect(skill.fields).toEqual({ ok: false, refusal: "rate", note: text })

    const style = await callTool("airdesign_get_style", {}, session, host)
    expect(style.ok).toBe(false)
    expect(style.fields).toEqual({ ok: false, refusal: "rate", note: text })
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
      expect(listed.fields).toEqual({
        ok: true,
        styles: [{ name: "editorial", summary: "Calm editorial layout with strong serif headlines." }],
        note: "Call airdesign_get_style with a style name to read its guide and parameters.",
      })

      const loaded = getStyleTool({ name: "editorial" }, root)
      expect(loaded.ok).toBe(true)
      expect(loaded.fields).toMatchObject({
        ok: true,
        name: "editorial",
        parameters: [
          { name: "headingFont", description: "Heading font family" },
          { name: "accent", description: "Single accent colour" },
        ],
        note: "Style editorial. Set its parameters before applying it to a deck.",
      })
      expect((loaded.fields as { text: string }).text).toContain("# Editorial")

      const missing = getStyleTool({ name: "nope" }, root)
      expect(missing.ok).toBe(false)
      expect(missing.fields).toMatchObject({
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
