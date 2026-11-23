import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { expect, type CDPSession, type Page } from "@playwright/test"
import { test } from "./api-stack"
import { dragFeel, type Feel } from "./drag-feel"
import { openDoomEditor } from "./doom-deck"
import { keptWait, keptWaitApproval } from "./kept-wait"

test.use({ viewport: { width: 1600, height: 1000 } })

const budget = {
  slides: 40,
  idleTaskMilliseconds: 150,
  typeScriptPerKey: 8,
  typeMeasureCalls: 6,
  dragScriptPerFrame: 8,
  dragTaskPerFrame: 16,
  dragLongFrames: 0,
  agentEditPaintMilliseconds: 80,
}

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

async function engineMilliseconds(device: CDPSession, name: "TaskDuration" | "ScriptDuration"): Promise<number> {
  const { metrics } = (await device.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] }
  return (metrics.find((metric) => metric.name === name)?.value ?? 0) * 1000
}

test("a 40-slide Doom deck does no picture work while no agent reads it and keeps a drag inside one frame", async ({
  page,
  context,
  stack,
}) => {
  const requested: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/doom/pictures") requested.push(request.url())
  })
  const opened = await openDoomEditor(page, context, stack)
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
  await device.send("Performance.enable", { timeDomain: "threadTicks" })
  await page.locator(`[data-doom-ready="${opened.deck}"]`).waitFor()
  await page.locator('[data-slide-entry="2"]').click()
  const node = page.locator("[data-slide-box] [data-node]").first()
  await expect(node).toBeVisible()
  const box = await node.boundingBox()
  if (box === null) throw new Error("no node")
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.click(from.x, from.y)
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  await frames(page, 240)

  const before = await engineMilliseconds(device, "TaskDuration")
  await page.waitForTimeout(
    keptWait(3000, {
      why: "the quiet span is what is measured, and frames the test drove would count as the deck's own work",
      until: "2027-02-18",
      approval: keptWaitApproval,
    }),
  )
  const idle = (await engineMilliseconds(device, "TaskDuration")) - before
  expect(idle, `an open deck idles at most ${String(budget.idleTaskMilliseconds)} ms of work in 3 s`).toBeLessThan(
    budget.idleTaskMilliseconds,
  )

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
  const keys = 24
  const typedFrom = await engineMilliseconds(device, "ScriptDuration")
  for (let key = 0; key < keys; key += 1) {
    await page.keyboard.press("a")
    await frames(page, 2)
  }
  const typing = (await engineMilliseconds(device, "ScriptDuration")) - typedFrom
  const measured = await page.evaluate(() => (window as unknown as { measured: number }).measured)
  await page.keyboard.press("Escape")
  await page.mouse.click(from.x, from.y)
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)

  const feel = await dragFeel(page, from, { x: 240, y: 90 }, 120, "dragged")
  await reportDrag(feel)

  const target = await page.locator("[data-slide-box] [data-node]").nth(1).getAttribute("data-node")
  const painted: number[] = []
  for (let edit = 1; edit <= 5; edit += 1) {
    await page.evaluate((id) => {
      const first = document.querySelector(`[data-slide-box] [data-node="${String(id)}"]`)?.getAttribute("style")
      const holder = window as unknown as { agentPainted: Promise<number> }
      holder.agentPainted = new Promise<number>((resolve) => {
        const watch = new MutationObserver(() => {
          const now = document.querySelector(`[data-slide-box] [data-node="${String(id)}"]`)?.getAttribute("style")
          if (now === first) return
          watch.disconnect()
          requestAnimationFrame(() => setTimeout(() => resolve(Date.now())))
        })
        watch.observe(document.querySelector("[data-slide-box]")!, { subtree: true, childList: true, attributes: true })
      })
    }, target)
    const sent = Date.now()
    const landed = await stack.post(
      doomRoutes.edit.path,
      {
        deck: opened.deck,
        edit: {
          once: `speed-agent-${String(edit)}`,
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
    painted.push(
      (await page.evaluate(() => (window as unknown as { agentPainted: Promise<number> }).agentPainted)) - sent,
    )
  }
  painted.sort((left, right) => left - right)
  const agentEditPaint = painted[2]!
  test.info().annotations.push({
    type: "metric",
    description: `idle ${String(Math.round(idle))} ms in 3 s; ${String(measured)} text measurements; typing script ${String(Math.round((typing / keys) * 10) / 10)} ms a key; agent edit to paint ${String(agentEditPaint)} ms; drag script ${String(feel.scriptPerFrame)} ms and task ${String(feel.taskPerFrame)} ms a frame, ${String(feel.longFrames)} long frames`,
  })
  expect(measured, "typing measures a glyph or pair of glyphs once, never again on each key").toBeLessThanOrEqual(
    budget.typeMeasureCalls,
  )
  expect(typing / keys, "a typed letter's script work stays inside one frame").toBeLessThan(budget.typeScriptPerKey)
  expect(feel.scriptPerFrame, "a drag move's script work stays under 8 ms").toBeLessThan(budget.dragScriptPerFrame)
  expect(feel.taskPerFrame, "a drag move's main-thread work stays inside one frame").toBeLessThan(
    budget.dragTaskPerFrame,
  )
  expect(feel.longFrames, "no frame during a drag runs past 50 ms").toBeLessThanOrEqual(budget.dragLongFrames)
  expect(agentEditPaint, "an agent's edit paints in the open tab within a few frames").toBeLessThan(
    budget.agentEditPaintMilliseconds,
  )
  expect(requested, "no slide picture is painted or sent while no agent has asked for one").toEqual([])
})
