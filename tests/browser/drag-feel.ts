import type { CDPSession, Page } from "@playwright/test"

type Point = { readonly x: number; readonly y: number }

type Recorded = {
  readonly frames: readonly number[]
  readonly delays: readonly number[]
  readonly moves: number
  readonly long: number
  readonly thumbnails: number
  readonly panel: number
  readonly placements: number
  readonly restyled: number
}

export type Feel = {
  readonly frames: number
  readonly frameMedian: number
  readonly frameP95: number
  readonly frameLongest: number
  readonly delayMedian: number
  readonly delayP95: number
  readonly longFrames: number
  readonly moves: number
  readonly layouts: number
  readonly styles: number
  readonly scriptPerFrame: number
  readonly taskPerFrame: number
  readonly thumbnails: number
  readonly panel: number
  readonly placements: number
  readonly restyled: number
}

declare global {
  interface Window {
    feelStop?: () => Recorded
  }
}

const sampleGap = 8

function quantile(values: readonly number[], share: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  if (sorted.length === 0) return 0
  const at = (sorted.length - 1) * share
  const low = sorted[Math.floor(at)] ?? 0
  const high = sorted[Math.ceil(at)] ?? low
  return low + (high - low) * (at - Math.floor(at))
}

const tenths = (value: number) => Math.round(value * 10) / 10

async function engineCounts(device: CDPSession): Promise<Map<string, number>> {
  const { metrics } = (await device.send("Performance.getMetrics")) as {
    metrics: { name: string; value: number }[]
  }
  return new Map(metrics.map(({ name, value }) => [name, value]))
}

async function record(page: Page, dragged: string): Promise<void> {
  await page.evaluate((key) => {
    const frames: number[] = []
    const delays: number[] = []
    let waiting: number[] = []
    let settling: number[][] = []
    let moves = 0
    let long = 0
    let thumbnails = 0
    let panel = 0
    let placements = 0
    let restyled = 0
    let running = true
    const painted = new MessageChannel()
    painted.port1.onmessage = () => {
      const at = performance.now()
      for (const stamp of settling.shift() ?? []) delays.push(at - stamp)
    }
    const tick = (at: number) => {
      if (!running) return
      frames.push(at)
      settling.push(waiting)
      waiting = []
      painted.port2.postMessage(null)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    const onMove = (event: PointerEvent) => {
      moves += 1
      const raw = event.getCoalescedEvents?.() ?? []
      for (const each of raw.length === 0 ? [event] : raw) waiting.push(each.timeStamp)
    }
    window.addEventListener("pointermove", onMove, { capture: true })
    const loafs = new PerformanceObserver((list) => {
      long += list.getEntries().length
    })
    try {
      loafs.observe({ type: "long-animation-frame" })
    } catch {}
    const watched = { attributes: true, childList: true, subtree: true, characterData: true }
    const thumbWatch = new MutationObserver((list) => {
      thumbnails += list.length
    })
    for (const each of document.querySelectorAll("[data-thumb-paint]")) thumbWatch.observe(each, watched)
    const panelWatch = new MutationObserver((list) => {
      panel += list.length
    })
    for (const each of document.querySelectorAll("[data-design-panel]")) panelWatch.observe(each, watched)
    const placeWatch = new MutationObserver((list) => {
      placements += list.length
    })
    const textWatch = new MutationObserver((list) => {
      for (const each of list) {
        const target = each.target
        if (
          target instanceof HTMLElement &&
          (target.dataset.paragraph !== undefined || target.dataset.run !== undefined)
        )
          restyled += 1
      }
    })
    for (const each of document.querySelectorAll("[data-slide-paint] [data-text-body]"))
      textWatch.observe(each, { attributes: true, subtree: true })
    const frame = document.querySelector(`[data-slide-paint] [data-canvas-element="${key}"]`)
    if (frame !== null) placeWatch.observe(frame, { attributes: true, attributeFilter: ["style"] })
    window.feelStop = () => {
      running = false
      window.removeEventListener("pointermove", onMove, { capture: true })
      loafs.disconnect()
      thumbWatch.disconnect()
      panelWatch.disconnect()
      placeWatch.disconnect()
      textWatch.disconnect()
      settling = []
      return { frames, delays, moves, long, thumbnails, panel, placements, restyled }
    }
  }, dragged)
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function dragFeel(page: Page, from: Point, by: Point, samples: number, dragged: string): Promise<Feel> {
  const device = await page.context().newCDPSession(page)
  await device.send("Performance.enable", { timeDomain: "threadTicks" })
  const throttle = Number(process.env.AIRDESIGN_DRAG_THROTTLE ?? 1)
  if (throttle > 1) await device.send("Emulation.setCPUThrottlingRate", { rate: throttle })
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await record(page, dragged)
  const before = await engineCounts(device)
  const sent: Promise<unknown>[] = []
  for (let step = 1; step <= samples; step += 1) {
    const x = from.x + (by.x * step) / samples
    const y = from.y + (by.y * step) / samples
    sent.push(device.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left", buttons: 1 }))
    await pause(sampleGap)
  }
  await Promise.all(sent)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
  const after = await engineCounts(device)
  const recorded = await page.evaluate(() => window.feelStop?.())
  await page.mouse.move(from.x + by.x, from.y + by.y)
  await page.mouse.up()
  await device.detach()
  if (recorded === undefined) throw new Error("the drag was not recorded")
  const gaps = recorded.frames.slice(1).map((at, index) => at - (recorded.frames[index] ?? at))
  const grew = (name: string) => (after.get(name) ?? 0) - (before.get(name) ?? 0)
  const perFrame = (seconds: number) => tenths((seconds * 1000) / Math.max(gaps.length, 1))
  return {
    frames: gaps.length,
    frameMedian: tenths(quantile(gaps, 0.5)),
    frameP95: tenths(quantile(gaps, 0.95)),
    frameLongest: tenths(Math.max(0, ...gaps)),
    delayMedian: tenths(quantile(recorded.delays, 0.5)),
    delayP95: tenths(quantile(recorded.delays, 0.95)),
    longFrames: recorded.long,
    moves: recorded.moves,
    layouts: grew("LayoutCount"),
    styles: grew("RecalcStyleCount"),
    scriptPerFrame: perFrame(grew("ScriptDuration")),
    taskPerFrame: perFrame(grew("TaskDuration")),
    thumbnails: recorded.thumbnails,
    panel: recorded.panel,
    placements: recorded.placements,
    restyled: recorded.restyled,
  }
}
