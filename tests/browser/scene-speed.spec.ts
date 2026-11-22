import { pathToFileURL } from "node:url"
import { expect, type Page } from "@playwright/test"
import { test } from "./api-stack"
import { dragFeel } from "./drag-feel"
import { openSceneEditor } from "./scene-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const budget = {
  slides: 40,
  idleTaskMilliseconds: 150,
  dragScriptPerFrame: 8,
  dragTaskPerFrame: 16,
  dragLongFrames: 0,
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

async function taskMilliseconds(page: Page): Promise<number> {
  const device = await page.context().newCDPSession(page)
  try {
    await device.send("Performance.enable")
    const { metrics } = (await device.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] }
    return (metrics.find((metric) => metric.name === "TaskDuration")?.value ?? 0) * 1000
  } finally {
    await device.detach()
  }
}

test("a 40-slide Doom deck does no picture work while no agent reads it and keeps a drag inside one frame", async ({
  page,
  context,
  stack,
}) => {
  const requested: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/scenes/pictures") requested.push(request.url())
  })
  const opened = await openSceneEditor(page, context, stack)
  const { sceneRoutes } = await import("../../packages/catalog/src/index.ts")
  const { boardDeck } = (await import(
    pathToFileURL(`${process.cwd()}/.agents/skills/verify-airdesign/bench/doom-deck.mjs`).href
  )) as {
    boardDeck: (kit: unknown, cookie: string, count: number, deck: string) => Promise<readonly string[]>
  }
  const kit = {
    repo: process.cwd(),
    sceneRoutes,
    post: (route: { path: string }, body: unknown, cookie: string) => stack.post(route.path, body, cookie),
  }
  await boardDeck(kit, opened.cookie, budget.slides, opened.deck)
  await page.reload()
  await page.locator(`[data-scene-ready="${opened.deck}"]`).waitFor()
  await page.locator('[data-slide-entry="2"]').click()
  const node = page.locator("[data-slide-box] [data-node]").first()
  await expect(node).toBeVisible()
  const box = await node.boundingBox()
  if (box === null) throw new Error("no node")
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.click(from.x, from.y)
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  await frames(page, 90)

  const before = await taskMilliseconds(page)
  await frames(page, 180)
  const idle = (await taskMilliseconds(page)) - before
  expect(idle, `an open deck idles at most ${String(budget.idleTaskMilliseconds)} ms of work in 3 s`).toBeLessThan(
    budget.idleTaskMilliseconds,
  )

  const feel = await dragFeel(page, from, { x: 240, y: 90 }, 120, "dragged")
  test.info().annotations.push({
    type: "metric",
    description: `idle ${String(Math.round(idle))} ms in 3 s; drag script ${String(feel.scriptPerFrame)} ms and task ${String(feel.taskPerFrame)} ms a frame, ${String(feel.longFrames)} long frames`,
  })
  expect(feel.scriptPerFrame, "a drag move's script work stays under 8 ms").toBeLessThan(budget.dragScriptPerFrame)
  expect(feel.taskPerFrame, "a drag move's main-thread work stays inside one frame").toBeLessThan(
    budget.dragTaskPerFrame,
  )
  expect(feel.longFrames, "no frame during a drag runs past 50 ms").toBeLessThanOrEqual(budget.dragLongFrames)
  expect(requested, "no slide picture is painted or sent while no agent has asked for one").toEqual([])
})
