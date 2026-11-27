import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { guide, guides } from "./index.js"

const filesDir = fileURLToPath(new URL("../files", import.meta.url))

function guideFoldersIn(dir: string, prefix = ""): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) found.push(...guideFoldersIn(path.join(dir, entry.name), relative))
    else if (entry.name === "SKILL.md") found.push(prefix)
  }
  return found.sort()
}

const sha256 = (bytes: Uint8Array) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`

describe("guides", () => {
  it("reads every SKILL.md folder as a guide named by its path", () => {
    const all = guides()
    expect(all.map((each) => each.name)).toEqual(guideFoldersIn(filesDir))
    expect(all.map((each) => each.name)).toContain("execute")
    for (const each of all) {
      const raw = readFileSync(path.join(filesDir, each.name, "SKILL.md"), "utf8")
      expect(raw.startsWith(`---\nname: ${each.name.split("/").at(-1)!}\n`)).toBe(true)
      expect(each.description.length).toBeGreaterThan(0)
      expect(each.description.length).toBeLessThanOrEqual(1024)
    }
  })

  it("gives each guide its SKILL.md text after the frontmatter, byte for byte", () => {
    for (const each of guides()) {
      const raw = readFileSync(path.join(filesDir, each.name, "SKILL.md"), "utf8")
      const body = raw.slice(raw.indexOf("\n---\n", 4) + 5).trim()
      expect(guide(each.name)).toEqual(each)
      expect(each.markdown).toBe(body)
    }
  })

  it("lists every file of a guide with the digest and size of its bytes", () => {
    for (const each of guides()) {
      expect(each.files[0]?.path).toBe("SKILL.md")
      for (const file of each.files) {
        const bytes = readFileSync(path.join(filesDir, each.name, file.path))
        expect(file.bytes).toEqual(new Uint8Array(bytes))
        expect(file.size).toBe(bytes.byteLength)
        expect(file.digest).toBe(sha256(bytes))
      }
    }
    expect(guide("kit")?.files.map((file) => file.path)).toContain("kpi.json")
  })

  it("reads a guide only by its exact name", () => {
    expect(guide("execute")?.name).toBe("execute")
    for (const name of [
      "",
      "execute.md",
      " execute",
      "index",
      "charts",
      "styles",
      "styles/editorial",
      "../package.json",
      "/etc/passwd",
      "missing",
    ])
      expect(guide(name), name).toBeUndefined()
  })

  it("sends the agent from picking a theme to that theme's style", () => {
    const themeLine = guide("slides")
      ?.markdown.split("\n")
      .find((line) => line.includes("Pick the theme"))
    expect(themeLine).toContain("airdesign_get_style {name: <theme>}")
  })
})
