import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const folder = path.dirname(new URL(import.meta.url).pathname)
const skill = path.resolve(folder, "..")
const repo = path.resolve(skill, "../../..")
const index = readFileSync(path.join(folder, "README.md"), "utf8")
const features = readdirSync(folder).filter((file) => file.endsWith(".md") && file !== "README.md")
const journeys = readdirSync(path.join(skill, "journeys"))
  .filter((file) => file.endsWith(".mjs"))
  .map((file) => file.slice(0, -".mjs".length))
const sections = ["Sub-features", "How to get to it (user POV)", "Driving it with verify-airdesign", "Gotchas"]

describe("feature map", () => {
  it("lists every feature file once and links to no file that is gone", () => {
    const linked = [...index.matchAll(/\]\(\.\/([^)]+\.md)\)/g)].map((found) => found[1])
    expect([...linked].sort()).toEqual([...features].sort())
  })

  it("names every shipped journey, and the journeys suite drives each one", () => {
    const named = new Set([...index.matchAll(/`([a-z0-9-]+)`/g)].map((found) => found[1]))
    const suite = readFileSync(path.join(repo, "tests/journeys/journeys.spec.ts"), "utf8")
    for (const journey of journeys) {
      expect(named.has(journey), `features/README.md names ${journey}`).toBe(true)
      expect(suite, `tests/journeys/journeys.spec.ts drives ${journey}`).toContain(`"${journey}"`)
    }
  })

  it("keeps each feature file to its title, one paragraph and the four sections in order", () => {
    for (const feature of features) {
      const text = readFileSync(path.join(folder, feature), "utf8")
      expect(text.startsWith("# "), `${feature} starts with its title`).toBe(true)
      const headings = [...text.matchAll(/^## (.+)$/gm)].map((found) => found[1])
      expect(headings, `${feature} has the four sections`).toEqual(sections)
    }
  })

  it("points only at skill files that exist", () => {
    for (const feature of [...features, "README.md"]) {
      const text = readFileSync(path.join(folder, feature), "utf8")
      for (const [, file] of text.matchAll(/`((?:look|journeys|bin)\/[A-Za-z0-9/._-]+\.mjs)`/g)) {
        expect(existsSync(path.join(skill, file)), `${feature} points at ${file}`).toBe(true)
      }
    }
  })
})
