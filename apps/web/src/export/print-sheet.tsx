import * as doom from "@airdesign/doom"
import { SlidePaint, useDoomSlide, waitForFonts } from "@airdesign/render"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { propOf } from "@/editing/node-props"
import { exportBaseName } from "@/export/export-file-name"
import { linkHref, pageAnchor } from "@/export/print-links"
import { pageRule, printHeight, printWidth } from "@/export/print-page"

type AssetUrl = (asset: string) => string | undefined
type Painted = { readonly nodes: readonly doom.Resolved[]; readonly background: readonly doom.ResolvedPaint[] }
type LinkBox = { readonly href: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }

const paintLimit = 30_000

function picturesOf(painted: Painted): readonly string[] {
  const walk = (nodes: readonly doom.Resolved[]): readonly string[] =>
    nodes.flatMap((node) => [
      ...node.fills.flatMap((paint) => (paint.kind === "image" ? [paint.asset] : [])),
      ...walk(node.children),
    ])
  return [
    ...painted.background.flatMap((paint) => (paint.kind === "image" ? [paint.asset] : [])),
    ...walk(painted.nodes),
  ]
}

function boxIn(page: DOMRect, element: Element, href: string): LinkBox {
  const box = element.getBoundingClientRect()
  return { href, x: box.left - page.left, y: box.top - page.top, w: box.width, h: box.height }
}

function linksOn(page: HTMLElement, view: doom.Doom, nodes: readonly doom.Resolved[], printed: ReadonlySet<string>) {
  const frame = page.getBoundingClientRect()
  const found: LinkBox[] = []
  const walk = (node: doom.Resolved) => {
    const element = page.querySelector(`[data-node="${CSS.escape(node.id)}"]`)
    if (element === null) return
    const link = propOf(view.nodes.get(node.id as doom.NodeId), "link")
    const whole = link === undefined ? null : linkHref(link, printed)
    if (whole !== null) found.push(boxIn(frame, element, whole))
    const lines = element.querySelectorAll(":scope > [data-line]")
    node.text?.lines.forEach((line, at) => {
      const spans = lines[at]?.querySelectorAll(":scope > [data-run]") ?? []
      line.runs.forEach((run, index) => {
        const href = run.link === undefined ? null : linkHref(run.link, printed)
        const span = spans[index]
        if (href !== null && span !== undefined) found.push(boxIn(frame, span, href))
      })
    })
    node.children.forEach(walk)
  }
  nodes.forEach(walk)
  return found
}

const nextFrame = () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))

async function decoded(urls: readonly string[]): Promise<void> {
  await Promise.all(
    urls.map((url) => {
      const picture = new Image()
      picture.src = url
      return picture.decode()
    }),
  )
}

function PrintSlide({
  view,
  slide,
  assetUrl,
  links,
  onPainted,
}: {
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly assetUrl: AssetUrl
  readonly links: readonly LinkBox[]
  readonly onPainted: (slide: doom.NodeId, painted: Painted) => void
}) {
  const { nodes, background, ready } = useDoomSlide(view, slide)
  const { size } = doom.deckOf(view)
  useEffect(() => {
    if (ready && nodes !== null) onPainted(slide, { nodes, background })
  }, [ready, nodes, background, slide, onPainted])
  return (
    <div
      id={pageAnchor(slide)}
      data-print-page={slide}
      style={{ position: "relative", width: printWidth, height: printHeight(size) }}
    >
      <SlidePaint
        nodes={nodes ?? []}
        background={background}
        size={size}
        width={printWidth}
        assetUrl={assetUrl}
        iconsReady={ready}
      />
      {links.map((link, at) => (
        <a
          key={at}
          href={link.href}
          tabIndex={-1}
          style={{ position: "absolute", display: "block", left: link.x, top: link.y, width: link.w, height: link.h }}
        />
      ))}
    </div>
  )
}

export function PrintSheet({
  view,
  slides,
  name,
  assetUrl,
  onReady,
  onPrinted,
  onFailed,
}: {
  readonly view: doom.Doom
  readonly slides: readonly doom.NodeId[]
  readonly name: string
  readonly assetUrl: AssetUrl
  readonly onReady: () => boolean
  readonly onPrinted: () => void
  readonly onFailed: () => void
}) {
  const sheet = useRef<HTMLDivElement>(null)
  const failing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const calls = useRef({ onReady, onPrinted, onFailed, name, urls: [] as readonly string[] })
  const [painted, setPainted] = useState<ReadonlyMap<doom.NodeId, Painted>>(new Map())
  const [links, setLinks] = useState<ReadonlyMap<string, readonly LinkBox[]> | null>(null)
  const [onPainted] = useState(
    () => (slide: doom.NodeId, made: Painted) => setPainted((was) => new Map(was).set(slide, made)),
  )
  const pictures = [...painted.values()].flatMap(picturesOf)
  const urls = pictures.map(assetUrl)
  const settled = painted.size === slides.length && urls.every((url) => url !== undefined)
  useEffect(() => {
    calls.current = { onReady, onPrinted, onFailed, name, urls: urls.filter((url) => url !== undefined) }
  })

  useEffect(() => {
    failing.current = setTimeout(() => calls.current.onFailed(), paintLimit)
    return () => clearTimeout(failing.current)
  }, [])

  useEffect(() => {
    const host = sheet.current
    if (!settled || links !== null || host === null) return
    const printed = new Set<string>(slides)
    const found = new Map<string, readonly LinkBox[]>()
    for (const page of host.querySelectorAll<HTMLElement>("[data-print-page]")) {
      const slide = page.dataset["printPage"] as doom.NodeId
      const made = painted.get(slide)
      if (made !== undefined) found.set(slide, linksOn(page, view, made.nodes, printed))
    }
    setLinks(found)
  }, [settled, links, slides, painted, view])

  useEffect(() => {
    if (links === null) return
    let live = true
    let title: string | undefined
    const restore = () => {
      if (title === undefined) return
      document.title = title
      title = undefined
    }
    const after = () => {
      restore()
      calls.current.onPrinted()
    }
    window.addEventListener("afterprint", after, { once: true })
    void (async () => {
      await waitForFonts(document)
      await decoded(calls.current.urls)
      await nextFrame()
    })().then(
      () => {
        clearTimeout(failing.current)
        if (!live || !calls.current.onReady()) return
        title = document.title
        document.title = exportBaseName(calls.current.name)
        try {
          window.print()
        } finally {
          restore()
        }
      },
      () => {
        if (live) calls.current.onFailed()
      },
    )
    return () => {
      live = false
      restore()
      window.removeEventListener("afterprint", after)
    }
  }, [links])

  return createPortal(
    <div ref={sheet} data-print-sheet="" aria-hidden="true" inert>
      <style>{pageRule(doom.deckOf(view).size)}</style>
      {slides.map((slide) => (
        <PrintSlide
          key={slide}
          view={view}
          slide={slide}
          assetUrl={assetUrl}
          links={links?.get(slide) ?? []}
          onPainted={onPainted}
        />
      ))}
    </div>,
    document.body,
  )
}
