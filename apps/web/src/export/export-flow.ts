import type * as doom from "@airdesign/doom"
import { gestureFor } from "@/lib/gestures"
import { useEffect, useRef, useState } from "react"
import { chosenSlides, firstChoice, type ExportChoice } from "@/export/export-choice"
import { pagesToPrint } from "@/export/printed-slides"

export type ExportTarget = {
  readonly name: string
  readonly view: doom.Doom
  readonly slides: readonly doom.NodeId[]
  readonly current: number
  readonly skipped: readonly boolean[]
  readonly assetUrl: (asset: string) => string | undefined
}

export type ExportStart = "choosing" | "failed"

type Printing = { readonly view: doom.Doom; readonly slides: readonly doom.NodeId[]; readonly run: number }

export type ExportFlow = {
  readonly failed: false | "paint" | "fonts"
  readonly tryAgain: () => void
  readonly control: ReturnType<typeof useFlowState>
}

function useFlowState(target: ExportTarget, start: ExportStart | undefined) {
  const [open, setOpen] = useState(start === "choosing")
  const [choice, setChoice] = useState<ExportChoice>(() => firstChoice(target.slides.length))
  const [printing, setPrinting] = useState<Printing | null>(null)
  const [failed, setFailed] = useState<ExportFlow["failed"]>(start === "failed" ? "paint" : false)
  const runs = useRef(0)

  function print(next: ExportChoice) {
    const chosen = chosenSlides(next, target.slides.length, target.current)
    if (chosen === null) return
    const pages = pagesToPrint(target.slides, chosen, target.skipped, next.slides === "current")
    if (pages === null) return
    runs.current += 1
    setFailed(false)
    setPrinting({
      view: target.view,
      slides: pages,
      run: runs.current,
    })
  }

  return {
    target,
    open,
    choice,
    printing,
    failed,
    setChoice,
    print,
    openDialog: () => {
      if (open) return
      setFailed(false)
      setChoice(firstChoice(target.slides.length))
      setOpen(true)
    },
    close: () => {
      setPrinting(null)
      setOpen(false)
    },
    ready: (run: number) => {
      if (runs.current !== run) return false
      setOpen(false)
      return true
    },
    printed: (run: number) => {
      if (runs.current === run) setPrinting(null)
    },
    fail: (run: number, reason: "paint" | "fonts") => {
      if (runs.current !== run) return
      setPrinting(null)
      setOpen(false)
      setFailed(reason)
    },
  }
}

export function useExport(target: ExportTarget, start?: ExportStart): ExportFlow {
  const control = useFlowState(target, start)
  return { failed: control.failed, tryAgain: () => control.print(control.choice), control }
}

export function usePrintKeyHeld() {
  useEffect(() => {
    function hold(event: KeyboardEvent) {
      if (gestureFor(event, "editor") === "actions") event.preventDefault()
    }
    window.addEventListener("keydown", hold)
    return () => window.removeEventListener("keydown", hold)
  }, [])
}
