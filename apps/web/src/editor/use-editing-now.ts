import type * as doom from "@airdesign/doom"
import { useEffect, useState } from "react"
import { editingNow, heardWrites, quietIn, type Heard } from "./editing-now"

export function useEditingNow(view: doom.Doom, now: () => number): ReadonlySet<string> {
  const [heard, setHeard] = useState<Heard>(() => heardWrites(new Map(), view, now(), true))
  const [, setTick] = useState(0)
  useEffect(() => {
    setHeard((before) => heardWrites(before, view, now(), false))
  }, [view, now])
  useEffect(() => {
    const wait = quietIn(heard, now())
    if (wait === undefined) return
    const timer = setTimeout(() => setTick((tick) => tick + 1), wait)
    return () => clearTimeout(timer)
  }, [heard, now])
  return editingNow(heard, now())
}
