import type * as doom from "@airdesign/doom"
import { useEffect, useRef, useState } from "react"
import { editingNow, heardWrites, quietIn, type Heard } from "./editing-now"

export function useEditingNow(view: doom.Doom, now: () => number): ReadonlySet<string> {
  const heard = useRef<{ readonly view: doom.Doom; readonly runs: Heard } | null>(null)
  if (heard.current?.view !== view)
    heard.current = { view, runs: heardWrites(heard.current?.runs ?? new Map(), view, now(), heard.current === null) }
  const runs = heard.current.runs
  const [, setTick] = useState(0)
  useEffect(() => {
    const wait = quietIn(runs, now())
    if (wait === undefined) return
    const timer = setTimeout(() => setTick((tick) => tick + 1), wait)
    return () => clearTimeout(timer)
  }, [runs, now])
  return editingNow(runs, now())
}
