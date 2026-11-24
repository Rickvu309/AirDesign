import path from "node:path"
import { suitesFor } from "./suites.mjs"

const skillPath = ".agents/skills/verify-airdesign/"
const code = /\.(ts|tsx|mts|mjs|js)$/
const testFile = (file) => /\.(test|spec)\.[a-z]+$/.test(file)
export const repeatLimit = 6

const readOutsideGraph = (file) =>
  file === "vitest.config.mts" ||
  file === "pnpm-lock.yaml" ||
  file === "scripts/unit-test-files.mjs" ||
  path.basename(file) === "package.json" ||
  (/\.(json|sql)$/.test(file) && /^(apps|packages|tests)\//.test(file))

const unitSource = (file) =>
  code.test(file) &&
  (/^(apps|packages)\/[^/]+\/(src|worker)\//.test(file) ||
    file.startsWith(skillPath) ||
    (file.startsWith("tests/") && !file.startsWith("tests/browser/") && !file.startsWith("tests/journeys/")))

const appCode = (file) => file.startsWith("apps/web/src/") && !testFile(file)

export const importersOf = (graph, targets) => {
  const found = new Set(targets)
  for (let grew = true; grew;) {
    grew = false
    for (const [file, imports] of Object.entries(graph)) {
      if (found.has(file) || !imports.some((imported) => found.has(imported))) continue
      found.add(file)
      grew = true
    }
  }
  return [...found].sort()
}

const lookAreas = (changed) =>
  new Set(
    changed
      .filter((file) => !testFile(file))
      .flatMap((file) => {
        if (file.startsWith("packages/render/") || file.startsWith("apps/web/src/components/")) return ["editor"]
        if (/^apps\/web\/src\/[^/]+$/.test(file)) return ["editor"]
        const area = file.match(/^apps\/web\/src\/([^/]+)\//)?.[1]
        return area === undefined ? [] : [area]
      }),
  )

const unitStep = (changed) => {
  const outside = changed.filter(readOutsideGraph)
  if (outside.length > 0)
    return {
      kind: "unit-tests",
      files: outside,
      tests: "all",
      because: `${outside[0]} is read outside the import graph`,
    }
  const sources = changed.filter(unitSource)
  if (sources.length === 0) return undefined
  return { kind: "unit-tests", files: sources, tests: "related", because: `${String(sources.length)} changed sources` }
}

const readBy = (reads, file) =>
  Object.entries(reads)
    .filter(([, links]) => links.some((link) => link === file || (link.endsWith("/") && file.startsWith(link))))
    .map(([test]) => test)

const toolingStep = (changed, scripts, reads) => {
  const touched = changed.filter((file) => /^scripts\/[^/]+\.mjs$/.test(file))
  const imported = importersOf(scripts, touched).filter((file) => file.endsWith(".test.mjs") && file in scripts)
  const read = changed.filter((file) => readBy(reads, file).length > 0)
  const files = [...new Set([...imported, ...read.flatMap((file) => readBy(reads, file))])].sort()
  if (files.length === 0) return undefined
  return { kind: "script-tests", files, because: `${[...new Set([...touched, ...read])].join(", ")} changed` }
}

const specsStep = (changed, moved, replays) => {
  const touched = changed.flatMap((file) => file.match(/^specs\/([^/]+)\//)?.[1] ?? [])
  const topics = [...new Set([...moved, ...touched])].sort()
  if (topics.length === 0) return undefined
  const files = [...new Set(replays.filter(({ name }) => topics.includes(name)).flatMap(({ by }) => by))].sort()
  const why = moved.length > 0 ? `covered code moved for ${moved.join(", ")}` : `specs changed: ${touched.join(", ")}`
  return { kind: "model-check", topics, replays: files, because: why }
}

const browserStep = (changed, browser) => {
  const touched = changed.filter((file) => /^tests\/browser\/[^/]+\.(ts|mts)$/.test(file))
  const specs = importersOf(browser, touched).filter((file) => file.endsWith(".spec.ts"))
  if (specs.length === 0) return undefined
  const repeat = specs.length > repeatLimit ? 1 : 5
  const because =
    repeat === 1
      ? `${String(specs.length)} specs import the changed files, more than ${String(repeatLimit)}, so each runs once`
      : `${touched.join(", ")} changed`
  return { kind: "browser-tests", specs, repeat, workers: 1, cpu: "200%", because }
}

const lookStep = (changed, screens, states) => {
  const areas = lookAreas(changed)
  const named = changed.flatMap((file) => file.match(/look\/states\/([^/]+)\.mjs$/)?.[1] ?? [])
  const picked = states
    .filter((state) => named.includes(state.name) || (state.design && areas.has(screens[state.design])))
    .map((state) => state.name)
    .sort()
  if (picked.length === 0) return undefined
  const because = areas.size > 0 ? `touched ${[...areas].sort().join(", ")}` : `changed ${named.join(", ")}`
  return { kind: "look", states: picked, because }
}

const benchStep = (changed) => {
  const touched = changed.filter(
    (file) => /^(packages\/render|apps\/web\/src\/editor)\//.test(file) && code.test(file) && !testFile(file),
  )
  if (touched.length === 0) return undefined
  return { kind: "bench", because: `${touched[0]} changed` }
}

export const proofPlan = ({
  base,
  head,
  changed,
  moved = [],
  screens = {},
  states = [],
  replays = [],
  scripts = {},
  reads = {},
  browser = {},
  rules = [],
}) => {
  const browserRun = browserStep(changed, browser)
  const note =
    browserRun === undefined && changed.some(appCode)
      ? { kind: "note", text: "App code a person sees changed and no browser spec did. Write the failing spec first." }
      : undefined
  const steps = [
    unitStep(changed),
    toolingStep(changed, scripts, reads),
    specsStep(changed, moved, replays),
    browserRun,
    note,
    lookStep(changed, screens, states),
    benchStep(changed),
  ].filter(Boolean)
  return { base, head, changed, steps, ciAlso: suitesFor(changed, rules).map((suite) => suite.name) }
}
