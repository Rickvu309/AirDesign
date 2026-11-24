import { describe, expect, it } from "vitest"
import {
  agentPaintTasks,
  dragThreadTimes,
  keyTasks,
  pageThread,
  quietThread,
  redrawTimes,
  thumbnailRedraws,
  type ThreadSpan,
  type TraceEvent,
} from "./browser/renderer-thread"

const frameLimit = 20
const delayLimit = 50

const span = (name: string, ts: number, tdur: number, dur: number, kind = ""): ThreadSpan => ({
  name,
  ts,
  tdur,
  dur,
  kind,
})

const timer = (name: "TimerInstall" | "TimerFire", ts: number, id: number, tdur = 0): ThreadSpan => ({
  name,
  ts,
  tdur,
  dur: tdur,
  kind: "",
  timer: `page-frame/${String(id)}`,
})

const p95 = (values: readonly number[]) => {
  const sorted = [...values].sort((left, right) => left - right)
  const at = (sorted.length - 1) * 0.95
  const low = sorted[Math.floor(at)] ?? 0
  const high = sorted[Math.ceil(at)] ?? low
  return low + (high - low) * (at - Math.floor(at))
}

describe("the page's renderer main thread", () => {
  const editor = 4100
  const other = 4200
  const started = (frames: readonly { frame: string; processId: number }[]): TraceEvent => ({
    name: "TracingStartedInBrowser",
    pid: 1,
    tid: 1,
    ts: 0,
    args: { data: { frames } },
  })
  const named = (pid: number, tid: number, name: string): TraceEvent => ({
    name: "thread_name",
    ph: "M",
    pid,
    tid,
    args: { name },
  })
  const task = (pid: number, tid: number, ts: number, tdur: number): TraceEvent => ({
    name: "RunTask",
    ph: "X",
    pid,
    tid,
    ts,
    dur: tdur,
    tdur,
  })
  const busyOther = [
    named(editor, editor, "CrRendererMain"),
    named(editor, editor + 7, "Compositor"),
    named(other, other, "CrRendererMain"),
    task(editor, editor, 0, 4_000),
    task(editor, editor + 7, 0, 70_000),
    task(other, other, 0, 1_263_900),
  ]

  it("reads the renderer the trace names for the page's frame, not a busier second tab", () => {
    const spans = pageThread(
      [
        started([
          { frame: "editor-frame", processId: editor },
          { frame: "tab-frame", processId: other },
        ]),
        ...busyOther,
      ],
      "editor-frame",
    )
    expect(quietThread(spans, 50).work).toBe(4)
  })

  it("reads the page's renderer, not a site-isolated frame's renderer inside it", () => {
    const spans = pageThread(
      [
        started([
          { frame: "editor-frame", processId: editor },
          { frame: "child-frame", processId: other },
        ]),
        ...busyOther,
      ],
      "editor-frame",
    )
    expect(quietThread(spans, 50)).toEqual({ work: 4, tasks: 1, longTasks: [] })
  })

  it("fails a trace that does not name the page's renderer, so an empty trace is no reading", () => {
    expect(() => pageThread([], "editor-frame")).toThrow(/names no renderer/)
    expect(() =>
      pageThread([started([{ frame: "tab-frame", processId: other }]), ...busyOther], "editor-frame"),
    ).toThrow(/names no renderer/)
    expect(() => pageThread([started([{ frame: "editor-frame", processId: 9 }])], "editor-frame")).toThrow(
      /no main thread/,
    )
  })
})

describe("drag frame time", () => {
  it("reads the renderer thread, so a long wall gap while the core is elsewhere stays inside the budget", () => {
    const times = dragThreadTimes([
      span("RunTask", 0, 2_000, 80_000),
      span("FireAnimationFrame", 100, 1_500, 70_000),
      span("EventDispatch", 150, 40, 40_000, "mousemove"),
      span("FunctionCall", 160, 1_000, 60_000),
      span("RunTask", 200_000, 3_000, 90_000),
      span("FireAnimationFrame", 200_100, 2_500, 80_000),
      span("EventDispatch", 200_150, 30, 50_000, "mousemove"),
    ])
    expect(p95(times.frames)).toBeLessThan(frameLimit)
    expect(p95(times.delays)).toBeLessThan(delayLimit)
    expect(times.longFrames).toBe(0)
    expect(times.frames).toEqual([2, 3])
  })

  it("counts a 60 ms busy frame as the page's own time, over both budgets", () => {
    const times = dragThreadTimes([
      span("RunTask", 0, 60_000, 61_000),
      span("FireAnimationFrame", 20, 59_000, 59_500),
      span("EventDispatch", 40, 100, 100, "pointermove"),
    ])
    expect(p95(times.frames)).toBeGreaterThan(frameLimit)
    expect(p95(times.delays)).toBeGreaterThan(delayLimit)
    expect(times.longFrames).toBe(1)
  })

  it("adds the input task to the frame that paints it", () => {
    const times = dragThreadTimes([
      span("RunTask", 0, 1_000, 1_000),
      span("EventDispatch", 10, 80, 80, "mousemove"),
      span("RunTask", 8_000, 4_000, 4_000),
      span("FireAnimationFrame", 8_010, 3_500, 3_500),
    ])
    expect(times.frames).toEqual([4])
    expect(times.delays).toEqual([5])
    expect(times.longFrames).toBe(0)
  })

  it("places a frame in the task whose wall span holds it, not one whose thread time runs past its end", () => {
    const times = dragThreadTimes([
      span("RunTask", 0, 30_900, 30_000),
      span("RunTask", 30_100, 4_000, 4_000),
      span("FireAnimationFrame", 30_200, 3_500, 3_500),
    ])
    expect(times.frames).toEqual([4])
  })
})

describe("an idle deck's tasks", () => {
  const longTask = 50

  it("passes a task the scheduler paused, since the pause is wall time and not the page's work", () => {
    const quiet = quietThread([span("RunTask", 0, 7_850, 108_000), span("RunTask", 200_000, 1_000, 1_000)], longTask)
    expect(quiet.longTasks).toEqual([])
    expect(quiet.work).toBeCloseTo(8.85)
  })

  it("fails a task that keeps the renderer busy for 60 ms", () => {
    const quiet = quietThread([span("RunTask", 0, 60_000, 61_000)], longTask)
    expect(quiet.longTasks).toEqual([60])
  })

  it("counts a nested task once, inside the task that ran it", () => {
    const quiet = quietThread([span("RunTask", 0, 5_000, 5_000), span("RunTask", 1_000, 2_000, 2_000)], longTask)
    expect(quiet.tasks).toBe(1)
    expect(quiet.work).toBe(5)
  })

  it("keeps a task that starts as one ends, though the first one's thread time runs past its wall end", () => {
    const quiet = quietThread([span("RunTask", 0, 62_970, 62_070), span("RunTask", 62_150, 4_000, 4_000)], longTask)
    expect(quiet.tasks).toBe(2)
  })

  it("reads the outer of two tasks that start together, whatever order the trace lists them in", () => {
    const quiet = quietThread([span("RunTask", 0, 2_000, 2_000), span("RunTask", 0, 5_000, 5_000)], longTask)
    expect(quiet).toEqual({ work: 5, tasks: 1, longTasks: [] })
  })
})

describe("a typed letter's task", () => {
  it("reads the thread time of each task that dispatched a keydown, and no frame or timer between them", () => {
    const perKey = keyTasks([
      span("RunTask", 0, 4_000, 30_000),
      span("EventDispatch", 100, 3_000, 3_000, "keydown"),
      span("EventDispatch", 3_200, 500, 500, "keypress"),
      span("RunTask", 40_000, 3_000, 3_000),
      span("FireAnimationFrame", 40_100, 2_000, 2_000),
      span("RunTask", 60_000, 5_000, 5_000),
      span("RunTask", 100_000, 14_000, 14_000),
      span("EventDispatch", 100_100, 13_000, 13_000, "keydown"),
      span("RunTask", 120_000, 1_000, 1_000),
      span("EventDispatch", 120_100, 100, 100, "keyup"),
    ])
    expect(perKey).toEqual([4, 14])
  })

  it("reads the key's own task when the key queued behind a timer whose thread time runs past its wall end", () => {
    const perKey = keyTasks([
      span("RunTask", 1_000, 62_970, 62_070),
      span("RunTask", 63_150, 4_000, 4_000),
      span("EventDispatch", 63_250, 3_000, 3_000, "keydown"),
    ])
    expect(perKey).toEqual([4])
  })
})

describe("the thumbnail redraw a typed letter leaves for later", () => {
  const mark = "typed-slide-thumbnail"
  const updated = (ts: number): ThreadSpan => ({ ...span("TimeStamp", ts, 0, 0), message: mark })
  const keyInstalling = (ts: number, id: number) => [
    span("RunTask", ts, 6_000, 6_000),
    span("EventDispatch", ts + 100, 5_000, 5_000, "keydown"),
    timer("TimerInstall", ts + 200, id),
  ]
  const paintFrame = (ts: number, tdur: number) => [
    span("RunTask", ts, tdur, tdur),
    span("FireAnimationFrame", ts + 10, 100, 100),
    span("Paint", ts + 200, 300, 300),
  ]

  it("reads the timer task that updated the thumbnail and the next task that paints", () => {
    const redraws = thumbnailRedraws(
      [
        ...keyInstalling(0, 1),
        span("RunTask", 150_000, 4_600, 4_600),
        timer("TimerFire", 150_010, 1, 4_500),
        updated(154_000),
        span("RunTask", 156_000, 500, 500),
        ...paintFrame(160_000, 2_400),
      ],
      mark,
    )
    expect(redraws.map(redrawTimes)).toEqual([{ render: 4.6, paint: 2.4 }])
  })

  it("counts a 60 ms stall in the frame that paints the thumbnail", () => {
    const redraws = thumbnailRedraws(
      [
        ...keyInstalling(0, 1),
        span("RunTask", 150_000, 3_000, 3_000),
        timer("TimerFire", 150_010, 1, 2_900),
        updated(152_000),
        ...paintFrame(160_000, 62_000),
      ],
      mark,
    )
    expect(redraws.map(redrawTimes)).toEqual([{ render: 3, paint: 62 }])
  })

  it("reads no redraw from a timer a key installed that left the thumbnail as it was", () => {
    expect(
      thumbnailRedraws(
        [
          ...keyInstalling(0, 1),
          span("RunTask", 1_000, 100, 100),
          timer("TimerFire", 1_010, 1, 80),
          ...paintFrame(16_000, 2_000),
        ],
        mark,
      ),
    ).toEqual([])
  })

  it("reads no redraw from a thumbnail update no typed letter's timer ran", () => {
    expect(
      thumbnailRedraws(
        [
          ...keyInstalling(0, 1),
          span("RunTask", 20_000, 1_000, 1_000),
          timer("TimerInstall", 20_100, 2),
          span("RunTask", 150_000, 4_000, 4_000),
          timer("TimerFire", 150_010, 2, 3_900),
          updated(152_000),
          ...paintFrame(160_000, 2_000),
        ],
        mark,
      ),
    ).toEqual([])
  })

  it("reads no redraw whose paint the trace did not hold", () => {
    expect(
      thumbnailRedraws(
        [
          ...keyInstalling(0, 1),
          span("RunTask", 150_000, 4_000, 4_000),
          timer("TimerFire", 150_010, 1, 3_900),
          updated(152_000),
        ],
        mark,
      ),
    ).toEqual([])
  })
})

describe("an agent edit's paint", () => {
  const mark = (message: string, ts: number): ThreadSpan => ({ ...span("TimeStamp", ts, 0, 0), message })
  const arrivals = [
    span("RunTask", 0, 100_000, 100_000),
    span("RunTask", 200_000, 4_000, 4_000),
    mark("agent-edit-arrived", 200_100),
    span("RunTask", 207_000, 100_000, 100_000),
    span("RunTask", 210_000, 20_000, 20_000),
    span("Paint", 220_000, 300, 300),
    span("RunTask", 310_000, 8_000, 8_000),
    mark("agent-edit-rendered", 311_000),
    span("RunTask", 320_000, 40_000, 40_000),
  ]

  it("counts every top-level task from arrival through the first paint after render", () => {
    const spans = [
      ...arrivals,
      span("RunTask", 370_000, 3_000, 3_000),
      span("Paint", 371_000, 300, 300),
      span("RunTask", 380_000, 100_000, 100_000),
    ]
    expect(agentPaintTasks(spans).map((task) => task.thread)).toEqual([4, 100, 8, 40, 3])
  })

  it("counts a stalled paint inside the render task once", () => {
    const spans = [
      ...arrivals.slice(0, 6),
      span("RunTask", 310_000, 105_000, 105_000),
      mark("agent-edit-rendered", 311_000),
      span("Paint", 414_000, 300, 300),
    ]
    expect(agentPaintTasks(spans).map((task) => task.thread)).toEqual([4, 100, 105])
  })

  it("fails if the edit never paints", () => {
    expect(() => agentPaintTasks(arrivals)).toThrow("agent edit trace has no paint after the canvas update")
  })
})
