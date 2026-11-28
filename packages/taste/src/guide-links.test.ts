import { describe, expect, it } from "vitest"

import { guides } from "./index.js"

const names = new Set(guides().map((each) => each.name))
const families = new Set([...names].map((name) => name.split("/")[0]!))

function namedIn(markdown: string): string[] {
  const prose = markdown.replace(/^```[\s\S]*?^```/gm, "")
  return [...prose.matchAll(/`([a-z0-9-]+(?:\/[a-z0-9-]+)?)`/g)]
    .map(([, name]) => name!)
    .filter((name) => families.has(name.split("/")[0]!))
}

const linksOf = (name: string) =>
  namedIn(guides().find((each) => each.name === name)!.markdown).map((linked) =>
    linked.startsWith("kit/") ? "kit" : linked,
  )

function reachedFrom(start: string): Set<string> {
  const reached = new Set([start])
  const queue = [start]
  for (let name = queue.shift(); name !== undefined; name = queue.shift())
    for (const next of linksOf(name).filter((linked) => names.has(linked) && !reached.has(linked))) {
      reached.add(next)
      queue.push(next)
    }
  return reached
}

const playbooks = [...names].filter((name) => name.startsWith("playbooks/"))
const consultingCraft = /\bMECE\b|issue.tree|driver.equation|two-by-two|\b2x2\b|matched control|control group|qa-plan/i

describe("guide links", () => {
  it("names only guides that exist", () => {
    for (const each of guides())
      for (const linked of linksOf(each.name)) expect(names, `${each.name} names ${linked}`).toContain(linked)
  })

  it("has no principle guides or links to them", () => {
    expect([...names].filter((name) => name.startsWith("principles/"))).toEqual([])
    for (const each of guides()) expect(each.markdown, each.name).not.toContain("principles/")
  })

  it("reaches every guide from slides by following the names in it", () => {
    expect([...names].filter((name) => !reachedFrom("slides").has(name))).toEqual([])
  })

  it("sends the agent from slides to the five playbooks", () => {
    expect(playbooks.sort()).toEqual(
      ["decision-deck", "diagnosis-review", "pitch-keynote", "redesign-deck", "technical-review"].map(
        (job) => `playbooks/${job}`,
      ),
    )
    expect([...new Set(linksOf("slides").filter((linked) => linked.startsWith("playbooks/")))].sort()).toEqual(
      playbooks,
    )
  })

  it("reaches the kit and every recipe from at least one playbook", () => {
    const fromPlaybooks = new Set(playbooks.flatMap(linksOf))
    const recipes = [...names].filter((name) => name === "kit" || /^(charts|diagrams)\//.test(name))
    expect(recipes.filter((name) => !fromPlaybooks.has(name))).toEqual([])
  })

  it("keeps consulting craft to the decision and diagnosis playbooks", () => {
    const shared = [...names].filter(
      (name) =>
        name === "slides" ||
        (name.startsWith("playbooks/") && !["playbooks/decision-deck", "playbooks/diagnosis-review"].includes(name)),
    )
    for (const name of shared)
      expect(guides().find((each) => each.name === name)!.markdown, name).not.toMatch(consultingCraft)
  })
})
