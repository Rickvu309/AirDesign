import { execFileSync } from "node:child_process"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { keptWait, keptWaitApproval } from "./kept-wait"

type Kit = { page: Page; context: BrowserContext; out: string }
type State = { name: string; design: string | null }
type Unit = { states: State[] }
type Shard = { current: number; total: number }
type Look = {
  states: State[]
  shardStates: (selected: State[], shard: Shard) => State[]
  sweep: (
    selected: State[],
    open: (unit: Unit) => Promise<{ kit: Kit; close: () => Promise<void> }>,
    reached: (state: State, kit: Kit) => Promise<void>,
  ) => Promise<{ state: string; error: string }[]>
}
type Finding = { detector: string; selector: string; message: string }
type Scanner = { scan: (page: Page, options: object) => Promise<{ findings: Finding[]; used: number[] }> }
type Helper = {
  journeyKit: (given: { run: string; name: string; page: Page; context: BrowserContext }) => Promise<{
    kit: Omit<Kit, "out">
    out: string
  }>
}
type Reports = { writeReport: (root: string, name: string, shard: Shard, report: object) => void }
type Steps = { designShardOf: (env: NodeJS.ProcessEnv) => Shard }
type Pool = {
  contextPool: (
    browser: Browser,
    options: object,
  ) => {
    take: () => Promise<BrowserContext>
    give: (context: BrowserContext) => Promise<void>
    close: () => Promise<void>
  }
}

const root = process.cwd()
const skill = join(root, ".agents/skills/verify-airdesign")
const helper = join(skill, "bin/verify-airdesign.mjs")
const load = async <Module>(file: string) => (await import(pathToFileURL(file).href)) as Module
const swept = new Map<string, Finding[]>()
const ours = new Set<string>()

function seen(names: readonly string[], detector: string): string[] {
  return names
    .filter((name) => ours.has(name))
    .flatMap((name) => {
      const findings = swept.get(name)
      if (findings === undefined) throw new Error(`${name} was not reached, so nothing about it is known`)
      return findings
        .filter((finding) => finding.detector === detector)
        .map((finding) => `${name} ${finding.selector}: ${finding.message}`)
    })
}

test.describe.configure({ mode: "serial" })

test("loads product copy through workspace exports under Playwright", async () => {
  type IconCopy = { addIcon: string }
  const { readPictureToolCopy } = await load<{ readPictureToolCopy: () => IconCopy }>(
    join(skill, "bin/product-copy.mjs"),
  )
  const { pictureCopy } = await load<{ pictureCopy: IconCopy }>(join(root, "apps/web/src/copy/picture-copy.ts"))
  expect(readPictureToolCopy().addIcon).toEqual(expect.any(String))
  expect(readPictureToolCopy().addIcon).toBe(pictureCopy.addIcon)
})

test("every named state of this design shard is reached and scanned in one stack", async ({ browser }) => {
  test.setTimeout(
    keptWait(240_000, {
      why: "sweeps every named design state of its shard in one test, about 110 seconds on ci",
      until: "2027-02-18",
      approval: keptWaitApproval,
    }),
  )
  const started = performance.now()
  execFileSync("pnpm", ["--filter", "@airdesign/api", "build"], { cwd: root, stdio: "ignore" })
  const { run, origin } = JSON.parse(
    execFileSync(process.execPath, [helper, "launch", "--no-build"], { cwd: root, encoding: "utf8" }),
  ) as { run: string; origin: string }
  try {
    const { journeyKit } = await load<Helper>(helper)
    const { states, shardStates, sweep } = await load<Look>(join(skill, "look/states.mjs"))
    const { designShardOf } = await load<Steps>(join(root, "scripts/check-steps.mjs"))
    const shard = designShardOf(process.env)
    const selected = shardStates(states, shard)
    for (const state of selected) ours.add(state.name)
    const { scan } = await load<Scanner>(join(skill, "look/scan.mjs"))
    const catalog = await load<{ catalog: unknown; projectTools: (all: unknown) => { name: string }[] }>(
      join(root, "packages/catalog/dist/index.js"),
    )
    const identifiers = catalog.projectTools(catalog.catalog).map((tool) => tool.name)
    const rows: { page: string; findings: Finding[] }[] = []
    const used = new Set<number>()
    const { contextPool } = await load<Pool>(join(skill, "look/context-pool.mjs"))
    const contexts = contextPool(browser, {
      baseURL: origin,
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1470, height: 923 },
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    })
    const failed = await sweep(
      selected,
      async (unit) => {
        const context = await contexts.take()
        const page = await context.newPage()
        page.setDefaultTimeout(20_000)
        const name = `scan-${unit.states.map((state) => state.name).join("+")}`
        const { kit, out } = await journeyKit({ run, name, page, context })
        return { kit: { ...kit, out }, close: () => contexts.give(context) }
      },
      async (state, kit) => {
        await kit.page.evaluate(() => document.fonts.ready.then(() => undefined))
        const scanned = await scan(kit.page, { scope: state.name, identifiers })
        rows.push({ page: state.name, findings: scanned.findings })
        swept.set(state.name, scanned.findings)
        for (const index of scanned.used) used.add(index)
      },
    )
    await contexts.close()
    const failures = failed.map((failure) => ({ page: failure.state, error: failure.error }))
    rows.sort((a, b) => a.page.localeCompare(b.page))
    const { writeReport } = await load<Reports>(join(root, "scripts/design-findings.mjs"))
    writeReport(root, "states", shard, {
      rows,
      used: [...used],
      failures,
      seconds: (performance.now() - started) / 1000,
    })
    expect(failures, "every named state is reached").toEqual([])
    expect(rows.length).toBe(selected.length)
  } finally {
    execFileSync(process.execPath, [helper, "stop", run], { cwd: root, stdio: "ignore" })
  }
})

const editing = [
  "blank-deck",
  "slides-several",
  "editor-text-focused",
  "editor-selected",
  "editor-offline",
  "agent-empty",
]

test("the Agent panel names a tool's work in plain words, never its internal name", () => {
  expect(
    seen(["agent-working", "agent-done", "agent-failed"], "internal-identifier"),
    "a step shows an internal tool name",
  ).toEqual([])
})

test("the Agent panel shows an empty state before the first ask", () => {
  expect(seen(editing, "empty-region"), "the Agent panel is an empty column").toEqual([])
})

test("a selected text box draws one frame, not two", () => {
  expect(
    seen(["editor-text-focused", "editor-offline"], "stacked-frames"),
    "a selected text box draws two frames",
  ).toEqual([])
})

test("the offline notice shows its whole sentence", () => {
  expect(seen(["editor-offline"], "truncated-text"), "the offline notice is cut by an ellipsis").toEqual([])
})

test("the save status beside the deck name shows its whole words in readable ink", () => {
  const saveStates = ["editor-saving", "editor-went-offline", "editor-unreached", "editor-reached-again"]
  expect(seen(saveStates, "truncated-text"), "the save status is cut by an ellipsis").toEqual([])
  expect(seen(saveStates, "text-contrast"), "the save status is too faint to read").toEqual([])
})

test("an empty placeholder on a blank slide shows that it is there", () => {
  expect(seen(["blank-deck"], "invisible-control"), "an empty placeholder paints nothing").toEqual([])
})

test("an imported Calibri slide keeps its text inside its boxes", () => {
  expect(seen(["imported-text"], "overflowing-text"), "imported text runs past its box").toEqual([])
})

test("text in the real app meets WCAG AA contrast", () => {
  expect(seen([...swept.keys()], "text-contrast"), "text is below WCAG AA contrast").toEqual([])
})

test("the landing header keeps its name clear beside the product demo", () => {
  const landing = ["landing-product-playing", "landing-product-paused", "landing-product-reduced"]
  test.fail(
    landing.some((name) => ours.has(name)),
    "the fixed header name is flagged as clipped beside the product demo",
  )
  expect(
    seen(landing, "overflowing-text"),
    "the fixed header name is flagged as clipped beside the product demo",
  ).toEqual([])
})
