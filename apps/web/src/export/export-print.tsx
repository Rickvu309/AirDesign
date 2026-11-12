import { useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { pageRule, printWidth, type PrintSize } from "@/export/print-page"

async function painted(sheet: HTMLElement): Promise<void> {
  await document.fonts.ready
  await Promise.all([...sheet.querySelectorAll("img")].map((picture) => picture.decode().catch(() => undefined)))
  await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
}

export function PrintSheet({
  size,
  slides,
  slide,
  onReady,
  onPrinted,
}: {
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
    const after = () => printed.current()
    window.addEventListener("afterprint", after, { once: true })
    void painted(host).then(() => {
      if (live && ready.current()) window.print()
    })
    return () => {
      live = false
      window.removeEventListener("afterprint", after)
    }
  }, [])
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
