import { parseDot } from "./spec-graph.js"
import { dumpTopics } from "./spec-dump.js"
import { replayUsage } from "./usage-replay.js"
import { replayOauth } from "./oauth-replay.js"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as usageView from "../specs/usage/view.mjs"
import * as oauthView from "../specs/oauth/view.mjs"

type Value = boolean | number | string
type Spec = Record<string, Value>
type View = {
  state: (spec: Spec) => string
  step: (action: string, spec: Spec) => string | null
  group: (spec: Spec) => string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function readView(view: View, spec: Spec, action: string): string {
  const sentence = view.state(spec)
  const bucket = view.group(spec)
  const narrated = view.step(action, spec)
  if (typeof sentence !== "string" || typeof bucket !== "string") throw new Error(`${action} has no reader`)
  if (narrated !== null && typeof narrated !== "string") throw new Error(`${action} has no reader`)
  return `${bucket}: ${sentence}`
}

describe("spec replay", () => {
  it("replays every edge of the usage and oauth specs through the code", async () => {
    assertJar(jarPath())
    const every = topics(root)
    const folders = readdirSync(path.join(root, "specs"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(every.map((topic) => topic.name).sort()).toEqual(folders)
    for (const topic of every) expect(topic.view).toBe(true)
    const failures: string[] = []
    const reports: Record<string, unknown> = {}
    const views: Record<string, View> = { usage: usageView, oauth: oauthView }
    const found = every.filter((topic) => topic.name in views)
    for (const dumped of await dumpTopics(found)) {
      const topic = found.find((item) => item.name === dumped.name)
      if (!topic) throw new Error(dumped.name)
      if (!dumped.graph.includes("label=")) {
        failures.push(`${topic.name} dumped no graph\n${dumped.output.slice(-500)}`)
        continue
      }
      const graph = parseDot(dumped.graph)
      const view = views[topic.name]
      if (!view) throw new Error(`${topic.name} has no reader`)
      const told = (source: Spec, target: Spec, action: string) =>
        `${readView(view, source, action)} -${action}-> ${readView(view, target, action)}`
      if (topic.name === "usage") {
        reports.usage = {
          states: graph.states.size,
          edges: graph.edges.length,
          ...replayUsage(graph, told, failures),
        }
      }
      if (topic.name === "oauth") {
        reports.oauth = {
          states: graph.states.size,
          edges: graph.edges.length,
          ...replayOauth(graph, told, failures),
        }
      }
    }
    expect(failures, JSON.stringify(reports)).toEqual([])
    expect(reports).toMatchObject({
      usage: { replayed: expect.any(Number), stuttered: expect.any(Number) },
      oauth: { replayed: expect.any(Number), stuttered: expect.any(Number) },
    })
  }, 60_000)
})
