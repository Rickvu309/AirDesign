import * as doom from "@airdesign/doom"
import type { ListedStart } from "@/editing/slide-layout"

type Size = { readonly w: number; readonly h: number }
type Fills = doom.Props["fills"] | undefined

export type LayoutPicture = {
  readonly nodes: readonly doom.Resolved[]
  readonly background: readonly doom.ResolvedPaint[]
  readonly size: Size
}

export type LayoutPictures = { [Part in ListedStart]: LayoutPicture }

export type LayoutPictureSource = {
  readonly pictures: LayoutPictures | null
  readonly size: Size
  readonly warm: () => void
}

const cached = new WeakMap<doom.Theme, Map<string, LayoutPictures>>()
const inflight = new WeakMap<doom.Theme, Map<string, Promise<LayoutPictures>>>()

const person = { kind: "person", id: "layout-picture" } as const

function pictureKey(size: Size, fills: Fills): string {
  return JSON.stringify([size.w, size.h, fills ?? null])
}

function heldFor(theme: doom.Theme): Map<string, LayoutPictures> {
  const found = cached.get(theme)
  if (found !== undefined) return found
  const made = new Map<string, LayoutPictures>()
  cached.set(theme, made)
  return made
}

function jobsFor(theme: doom.Theme): Map<string, Promise<LayoutPictures>> {
  const found = inflight.get(theme)
  if (found !== undefined) return found
  const made = new Map<string, Promise<LayoutPictures>>()
  inflight.set(theme, made)
  return made
}

type Grown = { readonly doom: doom.Doom; readonly slides: readonly doom.NodeId[] }

function seed(theme: doom.Theme, size: Size, fills: Fills): Grown {
  return doom.doomFromTree({
    theme,
    size,
    slides: doom.slideStarts.map(() => ({
      children: [],
      ...(fills === undefined ? {} : { props: { fills } }),
    })),
  })
}

function minter(): () => doom.NodeId {
  let next = 0
  return () => doom.nodeId(`p:${String((next += 1))}`)
}

function planted(view: doom.Doom, grown: Grown, index: number, part: ListedStart, mint: () => doom.NodeId): doom.Doom {
  const slide = grown.slides[index]
  if (slide === undefined) return view
  const landed = doom.applyEdit(view, {
    once: `layout-${part}`,
    author: person,
    writes: doom.slideStartWrites(view, slide, mint, part),
    rev: doom.rev(view.rev + 1),
  })
  return doom.isRefusal(landed) ? view : landed
}

function grow(theme: doom.Theme, size: Size, fills: Fills): Grown {
  const grown = seed(theme, size, fills)
  const mint = minter()
  let view = grown.doom
  for (const [index, part] of doom.slideStarts.entries()) view = planted(view, grown, index, part, mint)
  return { doom: view, slides: grown.slides }
}

function pictureOf(view: doom.Doom, slide: doom.NodeId | undefined, size: Size, measure: doom.Measure): LayoutPicture {
  return slide === undefined
    ? { nodes: [], background: [], size }
    : { nodes: doom.resolveSlide(view, slide, measure), background: doom.slideBackground(view, slide), size }
}

function picturesOf(
  view: doom.Doom,
  slides: readonly doom.NodeId[],
  size: Size,
  measure: doom.Measure,
): LayoutPictures {
  const pictures = {} as LayoutPictures
  for (const [index, part] of doom.slideStarts.entries()) pictures[part] = pictureOf(view, slides[index], size, measure)
  return pictures
}

export function readLayoutPictures(theme: doom.Theme, size: Size, fills: Fills): LayoutPictures | null {
  return cached.get(theme)?.get(pictureKey(size, fills)) ?? null
}

export function layoutPictures(theme: doom.Theme, size: Size, fills: Fills, measure: doom.Measure): LayoutPictures {
  const key = pictureKey(size, fills)
  const held = heldFor(theme)
  const hit = held.get(key)
  if (hit !== undefined) return hit
  const grown = grow(theme, size, fills)
  const made = picturesOf(grown.doom, grown.slides, size, measure)
  held.set(key, made)
  return made
}

function nextSlice(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (typeof scheduler?.yield === "function") return scheduler.yield()
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

async function warmInSlices(
  theme: doom.Theme,
  size: Size,
  fills: Fills,
  measureOf: (value: doom.Doom) => Promise<doom.Measure>,
  pause: () => Promise<void>,
): Promise<LayoutPictures> {
  await pause()
  const grown = seed(theme, size, fills)
  const mint = minter()
  let view = grown.doom
  for (const [index, part] of doom.slideStarts.entries()) {
    await pause()
    view = planted(view, grown, index, part, mint)
  }
  await pause()
  const measure = await measureOf(view)
  const pictures = {} as LayoutPictures
  for (const [index, part] of doom.slideStarts.entries()) {
    await pause()
    pictures[part] = pictureOf(view, grown.slides[index], size, measure)
  }
  heldFor(theme).set(pictureKey(size, fills), pictures)
  return pictures
}

export function warmLayoutPictures(
  theme: doom.Theme,
  size: Size,
  fills: Fills,
  measureOf: (value: doom.Doom) => Promise<doom.Measure>,
  pause: () => Promise<void> = nextSlice,
): Promise<LayoutPictures> {
  const ready = readLayoutPictures(theme, size, fills)
  if (ready !== null) return Promise.resolve(ready)
  const key = pictureKey(size, fills)
  const jobs = jobsFor(theme)
  const running = jobs.get(key)
  if (running !== undefined) return running
  const job = warmInSlices(theme, size, fills, measureOf, pause).finally(() => {
    if (jobs.get(key) === job) jobs.delete(key)
  })
  jobs.set(key, job)
  return job
}
