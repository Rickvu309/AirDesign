import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { expect, type Browser } from "@playwright/test"
import { test } from "./deck-test"

type Fault = { fault: string; at: string; message: string }
type Picture = {
  drawPicture: (page: unknown, html: string) => Promise<void>
  pictureFaults: (page: unknown) => Promise<Fault[]>
}
type Pager = { pageWidth: number; toHtml: (tree: unknown, css: string, local: Record<string, string>) => string }
type Reader = { readTree: (input: unknown, options: { resolves: () => boolean }) => { tree: unknown } }
type Tool = { interCss: (repo: string) => string }

const show = join(process.cwd(), ".agents/skills/show-airdesign")
const load = async <T>(name: string) => (await import(pathToFileURL(join(show, name)).href)) as T

const photo = (width: number) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="160"><rect width="100%" height="100%" fill="silver"/></svg>`)}`

const observed = (ref: string) => [{ ref, source: "Observed", verdict: "passed" }]

const result = {
  kind: "assure",
  question: "Does the picture tell a failed screen from a new one?",
  answer: {
    claim: "The picture no longer calls a broken screen new",
    group: { axis: "reasons", covers: "the old fault and the proof" },
    children: [
      { claim: "Before, any failure on main was labeled new", evidence: observed("before.png") },
      {
        claim: "Now only a screen main never had says new",
        group: { axis: "reasons", covers: "each label a person can see" },
        children: [
          { claim: "A broken screen says failed on main", evidence: observed("failed.png") },
          {
            claim: "CI has not checked the change yet",
            evidence: [{ ref: "https://example.test/pull/1", source: "Observed", verdict: "open" }],
          },
        ],
      },
      {
        claim: "One run still fails on the last screen",
        evidence: [{ ref: "run.md", source: "Observed", verdict: "failed" }],
      },
    ],
  },
}

const decision = {
  kind: "decide",
  question: "How should the picture label a screen main could not show?",
  answer: {
    claim: "Call it failed, and keep new for screens main has never had",
    group: { axis: "options", covers: "every label such a screen might get" },
    children: [
      { claim: "Keep calling every such screen new", evidence: [{ ref: "old.md", source: "Observed" }] },
      {
        claim: "Say failed unless main has never had the screen",
        chosen: true,
        evidence: [{ ref: "plan.md", source: "Proposal" }],
      },
      { claim: "Hide the screen from the picture", evidence: [{ ref: "plan.md", source: "Proposal" }] },
    ],
  },
}

const flow = {
  kind: "explain",
  question: "How does an agent hand work to the owner?",
  answer: {
    claim: "Show the plan, prove the work, show the result, and let the owner steer",
    group: { axis: "steps", covers: "one round of work, from question to next steer", loop: true },
    children: [
      { claim: "Show the plan before building", evidence: [{ ref: "plan.png", source: "Observed" }] },
      {
        claim: "Build the change and prove it",
        group: { axis: "parts", covers: "is it right, and is it good to use" },
        children: [
          { claim: "Correct: works, holds, exports", evidence: [{ ref: "verify.md", source: "Observed" }] },
          { claim: "Good to use: looks right, stays fast", evidence: [{ ref: "look.md", source: "Proposal" }] },
        ],
      },
      { claim: "The owner approves or steers the next round", evidence: [{ ref: "owner.md", source: "Observed" }] },
    ],
  },
}

const photos = { "before.png": photo(600), "failed.png": photo(420), "plan.png": photo(604) }

async function faultsOf(browser: Browser, input: unknown, local: Record<string, string>, css = "") {
  const { drawPicture, pictureFaults } = await load<Picture>("logic/picture.mjs")
  const { pageWidth, toHtml } = await load<Pager>("logic/page.mjs")
  const { readTree } = await load<Reader>("logic/tree.mjs")
  const { interCss } = await load<Tool>("bin/logic.mjs")
  const { tree } = readTree(input, { resolves: () => true })
  expect(tree).not.toBeNull()
  const context = await browser.newContext({ viewport: { width: pageWidth, height: 800 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await drawPicture(page, toHtml(tree, interCss(process.cwd()), local).replace("</style>", `${css}</style>`))
  const faults = await pictureFaults(page)
  await context.close()
  return faults
}

for (const [name, input] of Object.entries({ result, decision, flow }))
  test(`a ${name} page draws with no fault a person would see`, async ({ browser }) => {
    expect(await faultsOf(browser, input, photos)).toEqual([])
  })

test("a photo too wide for its box, a photo that did not load and a word too long for its box are each named", async ({
  browser,
}) => {
  const broken = structuredClone(result)
  broken.answer.children = broken.answer.children.map((child, index) =>
    index === 2 ? { ...child, claim: "One run still fails on the incomprehensibilitiesandsomemore screen" } : child,
  )
  const faults = await faultsOf(browser, broken, {
    "before.png": photo(900),
    "failed.png": "data:image/png;base64,AAAA",
  })
  expect(faults.map(({ fault, at }) => `${fault} ${at}`)).toEqual([
    "photo-shrunk A",
    "photo-missing B1",
    "text-past-box C",
  ])
  expect(faults[0]?.message).toBe(
    "The photo is drawn at 67% of its size, so its text is too small to read. Crop it to at most 604 px wide.",
  )
})

test("a part drawn past the picture's edge is named", async ({ browser }) => {
  const faults = await faultsOf(browser, decision, photos, ".d1 .badge{right:-90px}")
  expect(faults.map(({ fault, at }) => `${fault} ${at}`)).toEqual(["past-edge A", "past-edge B", "past-edge C"])
})
