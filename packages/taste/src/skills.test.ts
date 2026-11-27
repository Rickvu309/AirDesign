import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { listStyles, readSkill, readStyle, skills } from "./index.js"

const filesDir = fileURLToPath(new URL("../files", import.meta.url))

function skillFilesIn(dir: string, prefix = ""): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) found.push(...skillFilesIn(path.join(dir, entry.name), relative))
    else if (entry.name === "SKILL.md") found.push(prefix)
  }
  return found.sort()
}

const sha256 = (bytes: Uint8Array) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`

describe("skills pack", () => {
  it("reads every SKILL.md folder as a skill named by its last folder", () => {
    const guides = skills()
    expect(guides.map((guide) => guide.name)).toEqual(skillFilesIn(filesDir))
    expect(guides.map((guide) => guide.name)).toContain("execute")
    for (const guide of guides) {
      const raw = readFileSync(path.join(filesDir, guide.name, "SKILL.md"), "utf8")
      expect(raw.startsWith(`---\nname: ${guide.name.split("/").at(-1)!}\n`)).toBe(true)
      expect(guide.description.length).toBeGreaterThan(0)
      expect(guide.description.length).toBeLessThanOrEqual(1024)
    }
  })

  it("gives read_skill each SKILL.md's text after its frontmatter, byte for byte", () => {
    for (const guide of skills()) {
      const raw = readFileSync(path.join(filesDir, guide.name, "SKILL.md"), "utf8")
      const body = raw.slice(raw.indexOf("\n---\n", 4) + 5).trim()
      expect(readSkill(guide.name)).toEqual({ name: guide.name, markdown: body })
      expect(guide.markdown).toBe(body)
    }
  })

  it("lists every file of a skill with the digest and size of its bytes", () => {
    for (const guide of skills()) {
      expect(guide.files[0]?.path).toBe("SKILL.md")
      for (const file of guide.files) {
        const bytes = readFileSync(path.join(filesDir, guide.name, file.path))
        expect(file.bytes).toEqual(new Uint8Array(bytes))
        expect(file.size).toBe(bytes.byteLength)
        expect(file.digest).toBe(sha256(bytes))
      }
    }
    expect(
      skills()
        .find((guide) => guide.name === "kit")
        ?.files.map((file) => file.path),
    ).toContain("kpi.json")
  })

  it("accepts an optional .md suffix and rejects index, styles and traversal paths", () => {
    const plain = readSkill("execute")
    const withExtension = readSkill("execute.md")
    expect(withExtension).toEqual(plain)

    expect(readSkill("")).toBeUndefined()
    expect(readSkill("index")).toBeUndefined()
    expect(readSkill("charts")).toBeUndefined()
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
