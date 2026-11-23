import { useRef, useState, type ReactNode } from "react"
import { ExportButton } from "@/editor/editor-chrome"
import { chosenSlides, firstChoice, type ExportChoice } from "@/export/export-choice"
import { ExportDialog } from "@/export/export-dialog"
import { PrintSheet } from "@/export/export-print"
import type { PrintSize } from "@/export/print-page"

export type ExportRequest = {
  readonly slides?: readonly number[]
  readonly signal?: AbortSignal
}

export type ExportTarget = {
  readonly name: string
  readonly count: number
  readonly current: number
  readonly size: PrintSize | null
  readonly slide: (index: number, width: number) => ReactNode
  readonly onExport: (request: ExportRequest) => Promise<void> | void
  readonly selected?: readonly number[]
}

function everySlide(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index)
}

function ExportFlow({ target }: { target: ExportTarget }) {
  const button = useRef<HTMLButtonElement>(null)
  const running = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<ExportChoice>(() => firstChoice(target.count))
  const [exporting, setExporting] = useState(false)
  const [printing, setPrinting] = useState<readonly number[] | null>(null)

  function finish(controller: AbortController) {
    if (running.current !== controller) return
    running.current = null
    setExporting(false)
    setOpen(false)
  }

  function close() {
    running.current?.abort()
    running.current = null
    setExporting(false)
    setPrinting(null)
    setOpen(false)
  }

  function start() {
    const slides = chosenSlides(choice, target.count, target.current, target.selected)
    if (slides === null || running.current !== null) return
    const controller = new AbortController()
    running.current = controller
    setExporting(true)
    if (choice.format === "pdf") {
      setPrinting(slides ?? everySlide(target.count))
      return
    }
    void Promise.resolve(target.onExport({ ...(slides === undefined ? {} : { slides }), signal: controller.signal }))
      .catch(() => undefined)
      .finally(() => finish(controller))
  }

  function openDialog() {
    setChoice(firstChoice(target.count, target.selected))
    setOpen(true)
  }

  return (
    <>
      <ExportButton ref={button} onClick={openDialog} />
      <ExportDialog
        open={open}
        choice={choice}
        count={target.count}
        selected={target.selected?.length ?? 0}
        exporting={exporting}
        finalFocus={button}
        onChoice={setChoice}
        onExport={start}
        onClose={close}
      />
      {printing === null || target.size === null ? null : (
        <PrintSheet
          name={target.name}
          size={target.size}
          slides={printing}
          slide={target.slide}
          onReady={() => {
            const controller = running.current
            if (controller === null || controller.signal.aborted) return false
            finish(controller)
            return true
          }}
          onPrinted={() => setPrinting(null)}
        />
      )}
    </>
  )
}

export function ExportControl({ target }: { target?: ExportTarget }) {
  return target === undefined ? <ExportButton /> : <ExportFlow target={target} />
}
