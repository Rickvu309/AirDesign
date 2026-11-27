import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { expect, type Page } from "@playwright/test"
import { waitForAgentPaint, watchAgentPaint } from "./agent-paint"
import { test as stackTest } from "./api-stack"
import { dragFeel, type Feel } from "./drag-feel"
import { openEditor } from "./editor-deck"
import { editorSpeedBudget } from "./editor-speed-budget"
import { keptWait, keptWaitApproval } from "./kept-wait"
import {
  agentPaintTasks,
  keyTaskDumps,
  keyTasks,
  quietThread,
  redrawDumps,
  redrawTimes,
  thumbnailRedraws,
  tracedSpans,
} from "./renderer-thread"
import { measureOnQuietMachine } from "./speed-machine"
import { spikeKeys, typedLetters } from "./typed-letter"

const speedTasksFile = "speed-tasks.json"

const test = stackTest.extend<{ speedTasks: Map<string, unknown> }, { speedLock: void }>({
  speedLock: [
    async ({}, use) => {
      const { takeSpeedLock } = await import("../../scripts/machine-lock.mjs")
      const release = await takeSpeedLock()
      try {
        await use()
      } finally {
        await release()
      }
    },
    { scope: "worker", auto: true, timeout: 310_000 },
  ],
  speedTasks: async ({}, use, testInfo) => {
    const kept = new Map<string, unknown>()
    await use(kept)
    if (testInfo.status === testInfo.expectedStatus || kept.size === 0) return
    const file = testInfo.outputPath(speedTasksFile)
    await writeFile(file, `${JSON.stringify(Object.fromEntries(kept), null, 1)}\n`)
    await testInfo.attach(speedTasksFile, { path: file, contentType: "application/json" })
  },
})

test.use({ viewport: { width: 1600, height: 1000 } })

const thumbnailMark = "typed-slide-thumbnail"

const budget = editorSpeedBudget(process.env)

async function frames(page: Page, count: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count
        const tick = () => (left-- <= 0 ? resolve() : requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
    count,
  )
}

async function reportDrag(feel: Feel): Promise<void> {
  const limits = JSON.parse(await readFile(join(process.cwd(), "metrics.json"), "utf8")) as Record<
    string,
    { readonly limit?: number }
  >
  for (const [name, now] of [
    ["drag-frame", feel.frameP95],
    ["drag-delay", feel.delayP95],
  ] as const) {
    const limit = limits[name]?.limit
    if (limit === undefined) throw new Error(`${name} has no limit in metrics.json.`)
    const notes = test.info().annotations
    notes.push({ type: "metric", description: `metric ${name}  now ${String(now)}  limit ${String(limit)}` })
    if (now > limit)
      notes.push({
        type: "warning",
        description: `${name} is ${String(now)} and its limit is ${String(limit)}. Make it faster.`,
      })
  }
}

test("a 40-slide Doom deck does no screenshot work while no agent reads it and keeps a drag inside one frame", async ({
  page,
  context,
  stack,
  speedTasks,
}, testInfo) => {
  const measure = <T>(phase: string, run: () => Promise<T>) => measureOnQuietMachine(speedTasks, phase, run, testInfo)
  const requested: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/doom/screenshots") requested.push(request.url())
  })
  const opened = await openEditor(page, context, stack)
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const { boardDeck } = (await import(
    pathToFileURL(`${process.cwd()}/.agents/skills/verify-airdesign/bench/doom-deck.mjs`).href
  )) as {
    boardDeck: (kit: unknown, cookie: string, count: number, deck: string) => Promise<readonly string[]>
  }
  const kit = {
    repo: process.cwd(),
    doomRoutes,
    post: (route: { path: string }, body: unknown, cookie: string) => stack.post(route.path, body, cookie),
  }
  const device = await context.newCDPSession(page)
  await boardDeck(kit, opened.cookie, budget.slides, opened.deck)
  await page.reload()
  await page.locator(`[data-editor-ready="${opened.deck}"]`).waitFor()
  await page.locator('[data-slide-entry="2"]').click()
  const node = page.locator("[data-slide-box] [data-node]").first()
  await expect(node).toBeVisible()
  const box = await node.boundingBox()
  if (box === null) throw new Error("no node")
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.click(from.x, from.y)
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  await frames(page, 240)

  const { reading: idle, checkSpeed: checkIdleSpeed } = await measure("idle", () =>
    tracedSpans(device, () =>
      page.waitForTimeout(
        keptWait(3000, {
          why: "the quiet span is what is measured, and frames the test drove would count as the deck's own work",
          until: "2027-02-18",
          approval: keptWaitApproval,
        }),
      ),
    ),
  )
  const quiet = quietThread(idle, budget.idleLongTaskMilliseconds)
  speedTasks.set("idle", { work: quiet.work, tasks: quiet.tasks, longTasks: quiet.longTasks })
  checkIdleSpeed(() => {
    expect(
      quiet.work,
      `an open deck idles at most ${String(budget.idleTaskMilliseconds)} ms of work in 3 s`,
    ).toBeLessThan(budget.idleTaskMilliseconds)
    expect(
      quiet.longTasks,
      `an open deck runs no idle task over ${String(budget.idleLongTaskMilliseconds)} ms of thread time in 3 s`,
    ).toEqual([])
  })

  await page.mouse.dblclick(from.x, from.y)
  await expect(page.locator("[data-text-editor]")).toHaveCount(1)
  await page.keyboard.press("End")
  await page.evaluate(() => {
    const counter = window as unknown as { measured: number }
    counter.measured = 0
    const measure = CanvasRenderingContext2D.prototype.measureText
    CanvasRenderingContext2D.prototype.measureText = function (...args) {
      counter.measured += 1
      return measure.apply(this, args)
    }
  })
  await page.evaluate((mark) => {
    const thumbnail = document.querySelector('[data-slide-entry="2"]')
    if (thumbnail === null) throw new Error("no thumbnail for the typed slide")
    new MutationObserver(() => console.timeStamp(mark)).observe(thumbnail, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
  }, thumbnailMark)
  const keys = 48
  const { reading: typed, checkSpeed: checkTypingSpeed } = await measure("typing", () =>
    tracedSpans(device, async () => {
      for (let key = 0; key < keys; key += 1) {
        await page.keyboard.press("a")
        await frames(page, 2)
      }
    }),
  )
  const perKey = keyTasks(typed)
  const thumbnailUpdates = thumbnailRedraws(typed, thumbnailMark)
  const typingLongTasks = quietThread(typed, budget.idleLongTaskMilliseconds).longTasks
  speedTasks.set("keys", keyTaskDumps(typed))
  speedTasks.set("redraws", redrawDumps(typed, thumbnailUpdates))
  speedTasks.set("typingLongTasks", typingLongTasks)
  expect(perKey, "every typed letter ran in a traced task").toHaveLength(keys)
  const typing = typedLetters(perKey)
  const redraws = thumbnailUpdates.map(redrawTimes)
  expect(redraws.length, "the filmstrip redrew the typed slide's thumbnail while the trace ran").toBeGreaterThanOrEqual(
    budget.typePreviewRedraws,
  )
  const meanOf = (values: readonly number[]) =>
    values.reduce((total, each) => total + each, 0) / Math.max(values.length, 1)
  const render = meanOf(redraws.map((each) => each.render))
  const paint = meanOf(redraws.map((each) => each.paint))
  await expect(page.locator('[data-slide-entry="2"]'), "the filmstrip shows the typed letters").toContainText(
    "a".repeat(keys),
  )
  const measured = await page.evaluate(() => (window as unknown as { measured: number }).measured)
  expect(measured, "typing measures a glyph or pair of glyphs once, never again on each key").toBeLessThanOrEqual(
    budget.typeMeasureCalls,
  )
  await page.keyboard.press("Escape")
  await page.mouse.click(from.x, from.y)
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)

  const { reading: feel, checkSpeed: checkDragSpeed } = await measure("pointer drag", () =>
    dragFeel(page, from, { x: 240, y: 90 }, 120, "dragged"),
  )
  await reportDrag(feel)

  const target = await page.locator("[data-slide-box] [data-node]").nth(1).getAttribute("data-node")
  if (target === null) throw new Error("no target for the agent edit")
  const { reading: painted, checkSpeed: checkAgentSpeed } = await measure("agent edit to paint", async () => {
    const edits: ReturnType<typeof agentPaintTasks>[] = []
    speedTasks.set("agentPaint", edits)
    for (let edit = 1; edit <= 5; edit += 1) {
      const once = `speed-agent-${String(edit)}`
      await watchAgentPaint(page, target, doomRoutes.since.path, once)
      const spans = await tracedSpans(device, async () => {
        const landed = await stack.post(
          doomRoutes.edit.path,
          {
            deck: opened.deck,
            edit: {
              once,
              author: { kind: "agent", id: "aira", run: "bench-run" },
              writes: [
                {
                  node: target,
                  prop: "box",
                  value: { x: 100 + edit * 40, y: 60, w: 400, h: 120, rotation: 0, flipH: false, flipV: false },
                },
              ],
            },
          },
          opened.cookie,
        )
        expect(landed.json, "a node the person never touched takes an agent's write").toMatchObject({ ok: true })
        await waitForAgentPaint(page)
      })
      edits.push(agentPaintTasks(spans))
    }
    return edits.map((tasks) => tasks.reduce((total, task) => total + task.thread, 0))
  })
  painted.sort((left, right) => left - right)
  const agentEditPaint = painted[2]!
  test.info().annotations.push({
    type: "metric",
    description: `idle ${String(Math.round(quiet.work * 10) / 10)} ms in 3 s over ${String(quiet.tasks)} tasks, ${String(quiet.longTasks.length)} over ${String(budget.idleLongTaskMilliseconds)} ms; ${String(measured)} text measurements; typing task ${String(Math.round(typing.trimmedMean * 100) / 100)} ms a key without the slowest ${String(spikeKeys)}, ${String(Math.round(typing.mean * 100) / 100)} with them, typical ${String(Math.round(typing.typical * 100) / 100)}, ${String(Math.round(typing.beyondTypical * 100) / 100)} beyond typical, slowest ${String(Math.round(typing.slowest * 10) / 10)}; thumbnail render ${String(Math.round(render * 100) / 100)} ms and paint ${String(Math.round(paint * 100) / 100)} ms over ${String(redraws.length)} updates, slowest ${String(Math.round(Math.max(0, ...redraws.map((each) => each.render + each.paint)) * 10) / 10)}; ${String(typingLongTasks.length)} tasks over ${String(budget.idleLongTaskMilliseconds)} ms while typing; agent edit to paint ${String(Math.round(agentEditPaint * 10) / 10)} ms; drag script ${String(feel.scriptPerFrame)} ms and task ${String(feel.taskPerFrame)} ms a frame, ${String(feel.longFrames)} long frames`,
  })
  checkTypingSpeed(() => {
    expect(
      typing.trimmedMean,
      `a typed letter's task stays inside one frame, leaving out the slowest ${String(spikeKeys)} letters`,
    ).toBeLessThan(budget.typeTaskPerKey)
    expect(typing.beyondTypical, "no share of typed letters runs much longer than the typical letter").toBeLessThan(
      budget.typeTaskBeyondTypical,
    )
    expect(render, "the thumbnail render that typing leaves for later fits in the frame beside a letter").toBeLessThan(
      budget.typePreviewRender,
    )
    expect(paint, "the frame that paints the typed slide's thumbnail fits in the frame beside a letter").toBeLessThan(
      budget.typePreviewPaint,
    )
    expect(
      typingLongTasks,
      `no task while typing, on any scheduler, runs over ${String(budget.idleLongTaskMilliseconds)} ms of thread time`,
    ).toEqual([])
  })
  checkDragSpeed(() => {
    expect(feel.scriptPerFrame, "a drag move's script work stays within its budget").toBeLessThan(
      budget.dragScriptPerFrame,
    )
    expect(feel.taskPerFrame, "a drag move's main-thread work stays inside one frame").toBeLessThan(
      budget.dragTaskPerFrame,
    )
    expect(feel.longFrames, "no frame during a drag runs past 50 ms").toBeLessThanOrEqual(budget.dragLongFrames)
  })
  checkAgentSpeed(() => {
    expect(agentEditPaint, "an agent's edit paints in the open tab within a few frames").toBeLessThan(
      budget.agentEditPaintMilliseconds,
    )
  })
  expect(requested, "no slide screenshot is painted or sent while no agent has asked for one").toEqual([])
})
