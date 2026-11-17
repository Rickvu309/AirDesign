import { useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { exportBaseName } from "@/export/export-file-name"
import { pageRule, printWidth, type PrintSize } from "@/export/print-page"

async function painted(sheet: HTMLElement): Promise<void> {
  await document.fonts.ready
  await Promise.all([...sheet.querySelectorAll("img")].map((picture) => picture.decode().catch(() => undefined)))
  await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
}

export function PrintSheet({
  name,
  size,
  slides,
  slide,
  onReady,
  onPrinted,
}: {
  name: string
  size: PrintSize
  slides: readonly number[]
  slide: (index: number, width: number) => ReactNode
  onReady: () => boolean
  onPrinted: () => void
}) {
  const sheet = useRef<HTMLDivElement>(null)
  const ready = useRef(onReady)
  const printed = useRef(onPrinted)
  useEffect(() => {
    ready.current = onReady
    printed.current = onPrinted
  })
  useEffect(() => {
    const host = sheet.current
    if (host === null) return
    let live = true
    let title: string | undefined
    const restore = () => {
      if (title === undefined) return
      document.title = title
      title = undefined
    }
    const after = () => {
      restore()
      printed.current()
    }
    window.addEventListener("afterprint", after, { once: true })
    void painted(host).then(() => {
      if (!live || !ready.current()) return
      title = document.title
      document.title = exportBaseName(name)
      try {
        window.print()
      } finally {
        restore()
      }
    })
    return () => {
      live = false
      restore()
      window.removeEventListener("afterprint", after)
    }
  }, [name])
  const width = printWidth(size)
  const height = Math.round((width * size.height) / size.width)
  return createPortal(
    <div ref={sheet} data-print-sheet aria-hidden="true" inert>
      <style>{pageRule(size)}</style>
      {slides.map((index) => (
        <div key={index} data-print-page style={{ width, height }}>
          {slide(index, width)}
        </div>
      ))}
    </div>,
    document.body,
  )
}
