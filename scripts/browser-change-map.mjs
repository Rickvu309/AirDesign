import path from "node:path"
import { specFolder, unrecordedSeconds, weightedShares } from "./spec-seconds.mjs"

export const inBrowser = (file) => file.startsWith(`${specFolder}/`)
export const browserSpec = (file) => inBrowser(file) && file.endsWith(".spec.ts")

export const editorSpeedSpec = "editor-speed.spec.ts"

export const designScans = ["tests/browser/design-states.spec.ts", "tests/browser/every-screen.spec.ts"]

export const browserSetup = [
  "playwright.config.ts",
  "tests/browser/launch.ts",
  "tests/browser/font-preview.mjs",
  "tests/browser/deck-test.ts",
  "tests/browser/api-stack.ts",
  "tests/browser/spec-seconds.json",
]

export const browserReach = (graph, walk) => {
  const closure = (file) => walk(file, (node) => graph.imports[node] ?? [])
  return {
    setup: new Set(browserSetup.flatMap((file) => [...closure(file)])),
    specs: new Map((graph.browserSpecs ?? []).map((file) => [file, closure(file)])),
  }
}

const specSecondsPerJob = 120

export const browserJobs = (specs, seconds, limit) => {
  const keys = specs.map((file) => file.slice(specFolder.length + 1))
  const weigh = unrecordedSeconds(seconds)
  const work = keys.reduce((sum, key) => sum + weigh(key), 0)
  const total = Math.max(1, Math.min(limit, keys.length, Math.ceil(work / specSecondsPerJob)))
  const { shares } = weightedShares({ keys, seconds, total, serialKey: editorSpeedSpec })
  const populated = shares.filter((share) => share.length > 0)
  return populated.map((share, index) => ({
    part: "browser",
    ...(populated.length > 1 ? { shard: `${index + 1}/${populated.length}` } : {}),
    browserSpecs: share.map((key) => path.posix.join(specFolder, key)),
  }))
}
