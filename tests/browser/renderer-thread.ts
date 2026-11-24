import type { CDPSession } from "@playwright/test"

export type ThreadSpan = {
  readonly name: string
  readonly ts: number
  readonly tdur: number
  readonly dur: number
  readonly kind: string
  readonly timer?: string
  readonly message?: string
}

export type DragThread = {
  readonly frames: readonly number[]
  readonly delays: readonly number[]
  readonly longFrames: number
}

export type QuietThread = {
  readonly work: number
  readonly tasks: number
  readonly longTasks: readonly number[]
}

export type TraceEvent = {
  readonly name?: string
  readonly ph?: string
  readonly pid?: number
  readonly tid?: number
  readonly ts?: number
  readonly tdur?: number
  readonly dur?: number
  readonly args?: {
    readonly name?: string
    readonly data?: {
      readonly type?: string
      readonly frame?: string
      readonly timerId?: number
      readonly message?: string
      readonly frames?: readonly { readonly frame?: string; readonly processId?: number }[]
    }
  }
}

const longFrameMilliseconds = 50
const rendererMainName = "CrRendererMain"
const tracingStarted = "TracingStartedInBrowser"
const keptInstants = new Set(["TimerInstall", "TimeStamp"])
const isSpan = (event: TraceEvent) => event.dur !== undefined || keptInstants.has(event.name ?? "")
const keptEvent = (event: TraceEvent) => event.name === "thread_name" || event.name === tracingStarted || isSpan(event)

const spanOf = (event: TraceEvent): ThreadSpan | undefined => {
  if (event.name === undefined || !isSpan(event) || event.ts === undefined) return undefined
  const data = event.args?.data
  return {
    name: event.name,
    ts: event.ts,
    tdur: event.tdur ?? 0,
    dur: event.dur ?? 0,
    kind: data?.type ?? "",
    ...(data?.timerId === undefined ? {} : { timer: `${data.frame ?? ""}/${String(data.timerId)}` }),
    ...(data?.message === undefined ? {} : { message: data.message }),
  }
}

export const pageThread = (events: readonly TraceEvent[], frame: string): readonly ThreadSpan[] => {
  const pid = events
    .filter((event) => event.name === tracingStarted)
    .flatMap((event) => event.args?.data?.frames ?? [])
    .find((each) => each.frame === frame)?.processId
  if (pid === undefined) throw new Error(`the trace names no renderer process for the page's frame ${frame}`)
  const tid = events.find(
    (event) => event.name === "thread_name" && event.pid === pid && event.args?.name === rendererMainName,
  )?.tid
  if (tid === undefined)
    throw new Error(`the trace holds no main thread for the page's renderer process ${String(pid)}`)
  return events
    .filter((event) => event.pid === pid && event.tid === tid)
    .map(spanOf)
    .filter((span) => span !== undefined)
}

export async function tracedSpans(device: CDPSession, during: () => Promise<void>): Promise<readonly ThreadSpan[]> {
  const { frameTree } = (await device.send("Page.getFrameTree")) as { frameTree: { frame: { id: string } } }
  const events: TraceEvent[] = []
  const collect = (payload: { value?: TraceEvent[] }) => {
    for (const event of payload.value ?? []) if (keptEvent(event)) events.push(event)
  }
  let complete = () => {}
  const finished = new Promise<void>((resolve) => {
    complete = resolve
  })
  device.on("Tracing.dataCollected", collect)
  device.on("Tracing.tracingComplete", complete)
  await device.send("Tracing.start", {
    traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] },
  })
  try {
    await during()
  } finally {
    await device.send("Tracing.end")
  }
  await finished
  device.off("Tracing.dataCollected", collect)
  device.off("Tracing.tracingComplete", complete)
  return pageThread(events, frameTree.frame.id)
}

const pointerMoves = new Set(["mousemove", "pointermove"])

const milliseconds = (microseconds: number) => microseconds / 1000

const contains = (outer: ThreadSpan, inner: ThreadSpan) => inner.ts >= outer.ts && inner.ts < outer.ts + outer.dur

const outermost = (tasks: readonly ThreadSpan[]): readonly ThreadSpan[] => {
  const sorted = [...tasks].sort((left, right) => left.ts - right.ts || right.dur - left.dur)
  const kept: ThreadSpan[] = []
  for (const task of sorted) {
    const last = kept.at(-1)
    if (last !== undefined && contains(last, task)) continue
    kept.push(task)
  }
  return kept
}

const topTasks = (spans: readonly ThreadSpan[]) => outermost(spans.filter((span) => span.name === "RunTask"))

const taskHolding = (tasks: readonly ThreadSpan[], inner: ThreadSpan): ThreadSpan | undefined =>
  tasks.find((task) => contains(task, inner))

const summed = (tasks: readonly ThreadSpan[], from: number, to: number) => {
  let thread = 0
  for (const task of tasks) {
    if (task.ts >= from && task.ts <= to) thread += task.tdur
  }
  return milliseconds(thread)
}

export const dragThreadTimes = (spans: readonly ThreadSpan[]): DragThread => {
  const tasks = topTasks(spans)
  const frameTasks: ThreadSpan[] = []
  const seen = new Set<ThreadSpan>()
  for (const frame of spans) {
    if (frame.name !== "FireAnimationFrame") continue
    const task = taskHolding(tasks, frame) ?? frame
    if (seen.has(task)) continue
    seen.add(task)
    frameTasks.push(task)
  }
  const frames = frameTasks.map((task) => milliseconds(task.tdur))
  const delays: number[] = []
  for (const input of spans) {
    if (input.name !== "EventDispatch" || !pointerMoves.has(input.kind)) continue
    const inputTask = taskHolding(tasks, input)
    const frameTask = frameTasks.find((task) => task.ts + task.dur > input.ts)
    const chosen = frameTask ?? inputTask
    if (chosen === undefined) continue
    if (inputTask === undefined || frameTask === undefined || inputTask === frameTask) {
      delays.push(milliseconds(chosen.tdur))
      continue
    }
    const from = Math.min(inputTask.ts, frameTask.ts)
    const to = Math.max(inputTask.ts, frameTask.ts)
    delays.push(summed(tasks, from, to))
  }
  return {
    frames,
    delays: delays.length > 0 ? delays : frames,
    longFrames: frames.filter((frame) => frame > longFrameMilliseconds).length,
  }
}

export const quietThread = (spans: readonly ThreadSpan[], longTask: number): QuietThread => {
  const tasks = topTasks(spans)
  return {
    work: milliseconds(tasks.reduce((total, task) => total + task.tdur, 0)),
    tasks: tasks.length,
    longTasks: tasks.map((task) => milliseconds(task.tdur)).filter((each) => each > longTask),
  }
}

const keydownTasks = (spans: readonly ThreadSpan[]): readonly ThreadSpan[] => {
  const tasks = topTasks(spans)
  const keydowns = spans.filter((span) => span.name === "EventDispatch" && span.kind === "keydown")
  return tasks.filter((task) => keydowns.some((keydown) => contains(task, keydown)))
}

export const keyTasks = (spans: readonly ThreadSpan[]): readonly number[] =>
  keydownTasks(spans).map((task) => milliseconds(task.tdur))

const holdsMark = (spans: readonly ThreadSpan[], task: ThreadSpan, mark: string) =>
  spans.some((span) => span.name === "TimeStamp" && span.message === mark && contains(task, span))

const holdsPaint = (spans: readonly ThreadSpan[], task: ThreadSpan) =>
  spans.some((span) => span.name === "Paint" && contains(task, span))

export type Redraw = { readonly timer: ThreadSpan; readonly paint: ThreadSpan }

export const thumbnailRedraws = (spans: readonly ThreadSpan[], mark: string): readonly Redraw[] => {
  const keys = keydownTasks(spans)
  const installed = new Set(
    spans
      .filter((span) => span.name === "TimerInstall" && keys.some((task) => contains(task, span)))
      .map((span) => span.timer),
  )
  const tasks = topTasks(spans)
  const redraws: Redraw[] = []
  for (const fire of spans) {
    if (fire.name !== "TimerFire" || !installed.has(fire.timer)) continue
    const timer = taskHolding(tasks, fire)
    if (timer === undefined || !holdsMark(spans, timer, mark)) continue
    const paint = tasks.find((task) => task.ts > timer.ts && holdsPaint(spans, task))
    if (paint !== undefined) redraws.push({ timer, paint })
  }
  return redraws
}

export const redrawTimes = (redraw: Redraw) => ({
  render: milliseconds(redraw.timer.tdur),
  paint: milliseconds(redraw.paint.tdur),
})

type TaskEvent = {
  readonly name: string
  readonly kind: string
  readonly at: number
  readonly wall: number
  readonly thread: number
}

type TaskDump = {
  readonly start: number
  readonly wall: number
  readonly thread: number
  readonly events: readonly TaskEvent[]
}

const taskDump = (spans: readonly ThreadSpan[], task: ThreadSpan): TaskDump => {
  const origin = spans.reduce((first, span) => Math.min(first, span.ts), task.ts)
  return {
    start: milliseconds(task.ts - origin),
    wall: milliseconds(task.dur),
    thread: milliseconds(task.tdur),
    events: spans
      .filter((span) => span !== task && contains(task, span))
      .map((span) => ({
        name: span.name,
        kind: span.kind || span.message || "",
        at: milliseconds(span.ts - task.ts),
        wall: milliseconds(span.dur),
        thread: milliseconds(span.tdur),
      })),
  }
}

export const keyTaskDumps = (spans: readonly ThreadSpan[]): readonly TaskDump[] =>
  keydownTasks(spans).map((task) => taskDump(spans, task))

export const redrawDumps = (spans: readonly ThreadSpan[], redraws: readonly Redraw[]) =>
  redraws.map((redraw) => ({ timer: taskDump(spans, redraw.timer), paint: taskDump(spans, redraw.paint) }))

export const agentArrivalMark = "agent-edit-arrived"
export const agentRenderMark = "agent-edit-rendered"

export const agentPaintTasks = (spans: readonly ThreadSpan[]): readonly TaskDump[] => {
  const tasks = topTasks(spans)
  const arrival = spans.find((span) => span.name === "TimeStamp" && span.message === agentArrivalMark)
  const render = spans.find(
    (span) =>
      span.name === "TimeStamp" && span.message === agentRenderMark && arrival !== undefined && span.ts >= arrival.ts,
  )
  if (arrival === undefined || render === undefined)
    throw new Error("agent edit trace has no matching arrival and canvas update")
  const paint = spans.find((span) => span.name === "Paint" && span.ts >= render.ts)
  if (paint === undefined) throw new Error("agent edit trace has no paint after the canvas update")
  const taskFor = (event: ThreadSpan) => {
    const task = taskHolding(tasks, event)
    if (task === undefined) throw new Error(`agent edit trace has no renderer task for ${event.message ?? event.name}`)
    return task
  }
  const from = taskFor(arrival).ts
  taskFor(render)
  const to = taskFor(paint).ts
  return tasks.filter((task) => task.ts >= from && task.ts <= to).map((task) => taskDump(spans, task))
}
