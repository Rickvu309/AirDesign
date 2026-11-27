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

  it.each([
    ["bar", "Before you draw a bar chart"],
    ["column", "Before you draw a column chart"],
    ["line", "Before you draw a line chart"],
    ["table", "Before you draw a table"],
  ])("leads the charts/%s description with when to read it", (name, trigger) => {
    expect(guide(`charts/${name}`)?.description.startsWith(trigger)).toBe(true)
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

  it("holds no share circle and no standalone avoid or review guide", () => {
    const names = guides().map((each) => each.name)
    for (const gone of ["avoid", "review", "charts/donut"]) expect(names, gone).not.toContain(gone)
  })

  it("reads a guide only by its exact name", () => {
    expect(guide("slides")?.name).toBe("slides")
    for (const name of [
      "",
      "slides.md",
      " slides",
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

  it("sends the agent from picking a style to reading its design text", () => {
    const styleLine = guide("slides")
      ?.markdown.split("\n")
      .find((line) => line.includes("variables("))
    expect(styleLine).toContain("variables({ style, variant })")
    expect(styleLine).toContain("airdesign_get_style {name: <style>}")
  })

  it("states the title limit without a trigger, in the router and every Headlines pause", () => {
    expect(guide("slides")?.markdown).toMatch(/12 words or fewer/)
    const playbooks = guides().filter((each) => each.name.startsWith("playbooks/"))
    expect(playbooks.length).toBe(5)
    for (const each of playbooks) {
      const headlines = each.markdown.split(/\n(?=## )/).find((section) => section.startsWith("## Pause 3: Headlines"))
      expect(headlines, each.name).toMatch(/12 words or fewer/)
    }
  })

  it.each([
    ["slides", 50],
    ["playbooks/", 70],
    ["principles/", 70],
  ])("keeps %s within %i lines", (prefix, most) => {
    const named = guides().filter((each) =>
      prefix.endsWith("/") ? each.name.startsWith(prefix) : each.name === prefix,
    )
    expect(named.length).toBeGreaterThan(0)
    for (const each of named) {
      const lines = readFileSync(path.join(filesDir, each.name, "SKILL.md"), "utf8")
        .trimEnd()
        .split("\n").length
      expect(lines, each.name).toBeLessThanOrEqual(most)
    }
  })

  it("leads each playbook and principle description with the moment to read it", () => {
    const triggered = guides().filter((each) => /^(playbooks|principles)\//.test(each.name))
    expect(triggered.length).toBe(9)
    for (const each of triggered) expect(each.description, each.name).toMatch(/^Read when /)
    for (const each of guides()) expect(each.description, each.name).not.toMatch(/before you design/i)
  })
})
