import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { listStyles, readSkill, readSkillIndex, readStyle } from "./index.js"

const filesDir = fileURLToPath(new URL("../files", import.meta.url))

function skillFilesIn(dir: string, prefix = ""): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      if (relative === "styles") continue
      found.push(...skillFilesIn(path.join(dir, entry.name), relative))
      continue
    }
    if (!entry.name.endsWith(".md") || relative === "index.md") continue
    found.push(relative.slice(0, -3))
  }
  return found.sort()
}

describe("skills pack", () => {
  it("opens every skill named in the index and indexes every skill file", () => {
    const index = readSkillIndex()
    expect(index.skills.length).toBeGreaterThan(0)
    expect(index.markdown).toContain("execute")

    for (const entry of index.skills) {
      expect(entry.when.length).toBeGreaterThan(0)
      const opened = readSkill(entry.name)
      expect(opened).toBeDefined()
      expect(opened?.name).toBe(entry.name)
      expect(opened?.markdown.length).toBeGreaterThan(0)
    }

    expect(index.skills.map((entry) => entry.name).sort()).toEqual(skillFilesIn(filesDir))
  })

  it("accepts an optional .md suffix and rejects index, styles and traversal paths", () => {
    const plain = readSkill("execute")
    const withExtension = readSkill("execute.md")
    expect(withExtension).toEqual(plain)

    expect(readSkill("")).toBeUndefined()
    expect(readSkill("index")).toBeUndefined()
    expect(readSkill("styles")).toBeUndefined()
    expect(readSkill("styles/editorial")).toBeUndefined()
    expect(readSkill("../package.json")).toBeUndefined()
    expect(readSkill("/etc/passwd")).toBeUndefined()
    expect(readSkill("missing")).toBeUndefined()
  })

  it("ships styles whose list summary is their opening sentence and refuses traversal names", () => {
    for (const style of listStyles()) {
      expect(style.summary).toMatch(/^For .+\.$/)
      expect(readStyle(style.name)?.parameters.length).toBeGreaterThan(0)
    }
    expect(readStyle("../index")).toBeUndefined()
  })

  it("sends the agent from picking a theme to that theme's style", () => {
    const themeLine = readSkill("slides")
      ?.markdown.split("\n")
      .find((line) => line.includes("Pick the theme"))
    expect(themeLine).toContain("airdesign_get_style {name: <theme>}")
  })

  it("lists styles and reads style text with parsed parameters from a styles folder", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "airdesign-skills-"))
    try {
      const stylesDir = path.join(root, "styles")
      mkdirSync(stylesDir, { recursive: true })
      writeFileSync(
        path.join(stylesDir, "editorial.md"),
        [
          "# Editorial",
          "",
          "High-contrast serif headings with restrained ink and paper surfaces.",
          "",
          "## Identity",
          "",
          "Calm, magazine-paced layout.",
          "",
          "## Parameters",
          "",
          "- `headingFont`: Display serif for titles",
          "- `bodyFont`: Sans-serif for body copy",
          "- `accent`: Single muted accent colour",
          "",
          "## Typography",
          "",
          "Keep body text at 24 px or above.",
          "",
        ].join("\n"),
      )

      expect(listStyles(root)).toEqual([
        {
          name: "editorial",
          summary: "High-contrast serif headings with restrained ink and paper surfaces.",
        },
      ])

      const style = readStyle("editorial", root)
      expect(style).toBeDefined()
      expect(style?.name).toBe("editorial")
      expect(style?.markdown).toContain("## Identity")
      expect(style?.parameters).toEqual([
        { name: "headingFont", description: "Display serif for titles" },
        { name: "bodyFont", description: "Sans-serif for body copy" },
        { name: "accent", description: "Single muted accent colour" },
      ])

      expect(readStyle("editorial.md", root)).toEqual(style)
      expect(readStyle("missing", root)).toBeUndefined()
      expect(readStyle("../index", root)).toBeUndefined()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
