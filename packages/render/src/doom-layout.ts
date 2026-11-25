import * as doom from "@airdesign/doom"
import {
  fallbackFont,
  fontRevision,
  loadFontLayout,
  hanLanguage,
  missingFaceRequest,
  servedLayout,
  type LayoutRequest,
  pickServedFace,
  pinnedOpticalSize,
  servedFontName,
  weightRange,
  type FontLayoutEngine,
  type LayoutFace,
} from "@airdesign/fonts"
import { useEffect, useMemo, useSyncExternalStore } from "react"
import {
  beforeFontDeadline,
  exactFamily,
  fontsFor,
  forgetExactFace,
  installExactFace,
  readServedFile,
  type FontLoader,
} from "./font-load.js"

type Request = LayoutRequest
type PaintFace = NonNullable<doom.ResolvedRun["face"]>
type Prepared = { readonly face: LayoutFace; readonly paint: PaintFace }
type Input = Parameters<doom.MeasureLayout>[0]

const keyOf = ({ family, weight, italic }: Request) => `${family}|${String(weight)}|${String(italic)}`

const withoutFonts = doom.measureWith({})

function paragraphLayout(
  engine: FontLayoutEngine,
  input: Input,
  locale: string,
  get: (request: Request) => Prepared | null | undefined,
): ReturnType<doom.MeasureLayout> {
  const paint = new Map<LayoutFace, PaintFace>()
  const result = servedLayout(engine, input, locale, (request) => {
    const found = get(request)
    if (found != null) paint.set(found.face, found.paint)
    return found == null ? found : found.face
  })
  if (result === undefined) return undefined
  return {
    ...result,
    ...(locale === "und" ? {} : { locale }),
    lines: result.lines.map((line) => ({
      ...line.range,
      advance: line.advance,
      faces: line.faces.map(({ range, face }) => ({ ...range, face: paint.get(face)! })),
      ...(line.display === undefined ? {} : { display: line.display }),
    })),
  }
}

type Entry = {
  readonly request: Request
  readonly users: Map<number, number>
  url?: string
  unpin?: () => void
  pinnedAs?: number
  value?: Prepared | null
  pending?: Promise<boolean>
  failed?: "read" | "capacity"
}

class BrowserLayout {
  private engine: FontLayoutEngine | undefined
  private readonly entries = new Map<string, Entry>()
  private readonly watchers = new Set<() => void>()
  private version = 0
  private publishQueued = false
  private readonly measures = new Map<
    string,
    {
      readonly measure: doom.Measure
      readonly dependencies: WeakMap<doom.Text, Set<Entry>>
    }
  >()
  private collecting: Set<Entry> | undefined

  private readonly doc: Document
  private readonly loader: FontLoader

  constructor(doc: Document, loader: FontLoader) {
    this.doc = doc
    this.loader = loader
  }

  entry(request: Request): Entry {
    const key = keyOf(request)
    let entry = this.entries.get(key)
    if (entry === undefined) {
      entry = { request, users: new Map() }
      this.entries.set(key, entry)
    }
    return entry
  }

  subscribe = (watcher: () => void): (() => void) => {
    this.watchers.add(watcher)
    return () => {
      this.watchers.delete(watcher)
    }
  }

  current = (): number => this.version

  pendingNames(): readonly string[] {
    return [
      ...new Set(
        [...this.entries.values()].flatMap((entry) =>
          entry.users.size > 0 && this.ready(entry) === undefined ? [entry.request.family.toLowerCase()] : [],
        ),
      ),
    ]
  }

  ready(entry: Entry): Prepared | null | undefined {
    const value = entry.value
    return value == null || this.engine?.hasFace(value.face) ? value : undefined
  }

  retain(entry: Entry, priority: number): void {
    if (priority > Math.max(-1, ...entry.users.keys()) && entry.failed === "capacity") delete entry.failed
    entry.users.set(priority, (entry.users.get(priority) ?? 0) + 1)
    this.pin(entry)
  }

  private pin(entry: Entry): void {
    const priority = Math.max(-1, ...entry.users.keys())
    if (entry.pinnedAs === priority) return
    entry.unpin?.()
    delete entry.unpin
    delete entry.pinnedAs
    if (priority >= 0 && entry.url !== undefined && this.engine !== undefined) {
      entry.unpin = this.engine.pinFace(fontRevision, entry.url, priority)
      entry.pinnedAs = priority
    }
  }

  release(entry: Entry, priority: number): void {
    const remaining = (entry.users.get(priority) ?? 1) - 1
    if (remaining === 0) entry.users.delete(priority)
    else entry.users.set(priority, remaining)
    this.pin(entry)
    if (entry.users.size === 0 && entry.failed === "capacity") delete entry.failed
  }

  measure(locale: string, retain?: (entry: Entry) => void): doom.Measure {
    let cached = this.measures.get(locale)
    if (cached === undefined) {
      const dependencies = new WeakMap<doom.Text, Set<Entry>>()
      const get = (request: Request) => {
        const entry = this.entry(request)
        this.collecting?.add(entry)
        return this.ready(entry)
      }
      const measure = doom.measureWithLayout((input) => {
        if (this.engine !== undefined) return paragraphLayout(this.engine, input, input.locale ?? locale, get)
        for (const run of input.runs)
          get({ family: servedFontName(run.font) ?? fallbackFont, weight: run.bold ? 700 : 400, italic: run.italic })
        get(missingFaceRequest)
        return undefined
      })
      cached = { measure, dependencies }
      this.measures.set(locale, cached)
    }
    const { dependencies, measure } = cached
    return (text, theme, width, fit) => {
      let entries = dependencies.get(text)
      if (entries === undefined) dependencies.set(text, (entries = new Set()))
      this.collecting = entries
      try {
        return measure(text, theme, width, fit)
      } finally {
        this.collecting = undefined
        if (retain !== undefined) for (const entry of entries) retain(entry)
      }
    }
  }

  private publish(): void {
    if (this.publishQueued) return
    this.publishQueued = true
    queueMicrotask(() => {
      this.publishQueued = false
      this.measures.clear()
      this.version += 1
      for (const watcher of this.watchers) watcher()
    })
  }

  private async prepare(entry: Entry): Promise<Prepared | null> {
    const { family, italic, weight } = entry.request
    const [engine, files] = await Promise.all([loadFontLayout(), this.loader.files(family)])
    this.engine = engine
    const file = pickServedFace(files, weight, italic)
    if (file === undefined) return null
    entry.url = file.url
    this.pin(entry)
    const [low, high] = weightRange(file)
    const clamped = Math.max(low, Math.min(high, weight))
    const face = await engine.prepareFace({
      revision: fontRevision,
      key: file.url,
      axes: { wght: clamped, opsz: pinnedOpticalSize },
      read: async () => {
        const bytes = await readServedFile(file.url)
        await installExactFace(this.doc, file, bytes)
        return bytes
      },
      onEvict: () => forgetExactFace(this.doc, file),
    })
    const variations = Object.entries(face.axes)
      .map(([axis, value]) => `"${axis}" ${String(value)}`)
      .join(", ")
    return {
      face,
      paint: {
        family: exactFamily(file.url),
        weight: clamped,
        style: file.style === "italic" ? "italic" : "normal",
        variations,
      },
    }
  }

  load(entry: Entry): Promise<boolean> {
    if (this.ready(entry) !== undefined) return Promise.resolve(true)
    if (entry.failed === "capacity") return Promise.resolve(false)
    return (entry.pending ??= this.prepare(entry)
      .then(
        (face) => {
          entry.value = face
          delete entry.failed
          return true
        },
        (error: unknown) => {
          entry.failed =
            error instanceof Error && error.name === "FontBudgetError" && entry.users.size > 0 ? "capacity" : "read"
          return false
        },
      )
      .finally(() => {
        delete entry.pending
        this.publish()
      }))
  }
}

class FontUse {
  private readonly entries = new Set<Entry>()
  private running = false
  private scheduled = false
  private retry: ReturnType<typeof setTimeout> | undefined
  private delay = 500

  private readonly layout: BrowserLayout

  private readonly locale: string
  private readonly priority: number

  constructor(layout: BrowserLayout, locale: string, priority: number) {
    this.layout = layout
    this.locale = locale
    this.priority = priority
  }

  measure(): doom.Measure {
    return this.layout.measure(this.locale, (entry) => {
      if (!this.entries.has(entry)) {
        this.entries.add(entry)
        if (this.running) this.layout.retain(entry, this.priority)
      }
      if (this.layout.ready(entry) === undefined && entry.failed === undefined) this.schedule()
    })
  }

  start(): () => void {
    this.running = true
    for (const entry of this.entries) this.layout.retain(entry, this.priority)
    this.schedule()
    return () => {
      this.running = false
      clearTimeout(this.retry)
      this.retry = undefined
      for (const entry of this.entries) this.layout.release(entry, this.priority)
    }
  }

  private schedule(): void {
    if (!this.running || this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      if (this.running) void this.load()
    })
  }

  private async load(): Promise<void> {
    const loaded = await this.settle()
    if (!this.running || loaded || this.retry !== undefined) return
    if (![...this.entries].some((entry) => entry.failed === "read")) return
    this.retry = setTimeout(() => {
      this.retry = undefined
      void this.load()
    }, this.delay)
    this.delay = Math.min(this.delay * 2, 8_000)
  }

  async settle(): Promise<boolean> {
    const loaded = await Promise.all([...this.entries].map((entry) => this.layout.load(entry)))
    return loaded.every(Boolean)
  }

  waiting(): boolean {
    return [...this.entries].some((entry) => this.layout.ready(entry) === undefined)
  }

  atCapacity(): boolean {
    return [...this.entries].some((entry) => entry.failed === "capacity")
  }

  failure(): boolean {
    return [...this.entries].some((entry) => this.layout.ready(entry) === undefined && entry.failed !== undefined)
  }
}

const layouts = new WeakMap<Document, BrowserLayout>()

function layoutFor(doc: Document): BrowserLayout | undefined {
  const loader = fontsFor(doc)
  if (loader === undefined) return undefined
  let layout = layouts.get(doc)
  if (layout === undefined) {
    layout = new BrowserLayout(doc, loader)
    layouts.set(doc, layout)
  }
  return layout
}

const locales = new WeakMap<doom.Doom, string>()
let latest: { readonly value: doom.Doom; readonly locale: string } | undefined

function sameTexts(before: doom.Doom, after: doom.Doom): boolean {
  if (doom.deckOf(before).language !== doom.deckOf(after).language) return false
  for (const [id, node] of after.nodes) {
    const was = before.nodes.get(id)
    if (was === node) continue
    if (was === undefined || doom.propOf(was, "text") !== doom.propOf(node, "text")) return false
    if (doom.parentOf(was) !== doom.parentOf(node)) return false
  }
  return true
}

export function deckLocale(
  value: doom.Doom,
  typing?: { readonly before: doom.Doom; readonly layer: doom.NodeId },
): string {
  const known = locales.get(value)
  if (known !== undefined) return known
  let locale: string
  if (typing !== undefined && layerLanguage(typing.before, typing.layer) === layerLanguage(value, typing.layer)) {
    locale = deckLocale(typing.before)
  } else if (latest !== undefined && sameTexts(latest.value, value)) {
    locale = latest.locale
  } else {
    const language = doom.deckOf(value).language
    locale = language === undefined || language === "und" ? hanLanguage(doom.deckTexts(value)) : language
  }
  locales.set(value, locale)
  latest = { value, locale }
  return locale
}

function layerLanguage(value: doom.Doom, layer: doom.NodeId): string {
  return hanLanguage([doom.propOf(value.nodes.get(layer), "text")?.chars ?? ""])
}

const noSubscription = () => () => {}
const zero = () => 0

export function useDoomMeasure(value: doom.Doom, slide?: doom.NodeId, priority = 0): doom.Measure {
  const layout = typeof document === "undefined" ? undefined : layoutFor(document)
  const locale = deckLocale(value)
  const use = useMemo(
    () => (layout === undefined || slide === undefined ? undefined : new FontUse(layout, locale, priority)),
    [layout, locale, slide, priority],
  )
  const version = useSyncExternalStore(layout?.subscribe ?? noSubscription, layout?.current ?? zero, zero)
  useEffect(() => use?.start(), [use])
  return useMemo(() => use?.measure() ?? layout?.measure(locale) ?? withoutFonts, [use, version, layout, locale])
}

export function pendingDoomFonts(doc: Document): readonly string[] {
  return layoutFor(doc)?.pendingNames() ?? []
}

export async function waitForDoomFonts(
  doc: Document,
  value: doom.Doom,
  slides: readonly doom.NodeId[],
): Promise<boolean> {
  const prepared = await prepareDoomFonts(doc, value, slides)
  if (typeof prepared === "string") return false
  prepared.release()
  return true
}

export async function prepareDoomFonts(
  doc: Document,
  value: doom.Doom,
  slides: readonly doom.NodeId[],
  samples: readonly Parameters<doom.Measure>[] = [],
): Promise<{ readonly measure: doom.Measure; readonly release: () => void } | "fonts" | "capacity"> {
  const layout = layoutFor(doc)
  if (layout === undefined) return { measure: withoutFonts, release: () => {} }
  const use = new FontUse(layout, deckLocale(value), 2)
  const release = use.start()
  let live = true
  let ready: doom.Measure | undefined
  try {
    await beforeFontDeadline(
      (async () => {
        while (live) {
          const measure = use.measure()
          const nodes = slides.flatMap((slide) => doom.resolveSlide(value, slide, measure))
          const measured = samples.map((args) => measure(...args))
          if (!nodes.some(hasPendingText) && !measured.some(({ lines }) => lines.some((line) => line.pending))) {
            ready = measure
            return true
          }
          if (!use.waiting() || !(await use.settle())) return false
        }
        return false
      })(),
    )
    return ready === undefined ? (use.atCapacity() ? "capacity" : "fonts") : { measure: ready, release }
  } finally {
    live = false
    if (ready === undefined) release()
  }
}

export async function measureDoom(
  doc: Document,
  value: doom.Doom,
  samples?: readonly Parameters<doom.Measure>[],
): Promise<doom.Measure> {
  const prepared = await prepareDoomFonts(
    doc,
    value,
    doom.slidesOf(value).map((slide) => slide.id),
    samples,
  )
  if (typeof prepared === "string") throw new Error("Font metrics unavailable")
  prepared.release()
  return prepared.measure
}

export function hasPendingText(node: doom.Resolved): boolean {
  return node.text?.lines.some((line) => line.pending) === true || node.children.some(hasPendingText)
}

export function bakeFontState(doc: Document, value: doom.Doom, frame: doom.NodeId): "ready" | "pending" | "failed" {
  const layout = layoutFor(doc)
  if (layout === undefined) return "ready"
  const { required } = doom.bakeTextLayers(value, frame)
  const { theme } = doom.deckOf(value)
  const use = new FontUse(layout, deckLocale(value), 1)
  const measure = use.measure()
  const pending = required.some((id) => {
    const text = doom.propOf(value.nodes.get(id), "text")
    return text !== undefined && measure(text, theme, null).lines.some((line) => line.pending)
  })
  return pending ? (use.failure() ? "failed" : "pending") : "ready"
}
