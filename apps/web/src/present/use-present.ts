import { useEffect, useRef, useState } from "react"
import { firstShow, showKey, stepShow, type Show, type ShowKey, type ShownDeck } from "@/present/present-steps"

export type PresentDeck = {
  readonly count: number
  readonly current: number
  readonly hidden?: readonly boolean[]
  readonly onLand: (index: number) => void
}

export type Clock = { readonly since: number | null; readonly banked: number }

export type Present = {
  readonly show: Show | null
  readonly controls: boolean
  readonly elapsed: number
  readonly running: boolean
  readonly start: (from: number) => void
  readonly step: (key: ShowKey) => void
  readonly wake: () => void
  readonly pause: () => void
  readonly restart: () => void
}

const idle = 2500

function secondsOf(clock: Clock, now: number): number {
  return clock.banked + (clock.since === null ? 0 : (now - clock.since) / 1000)
}

function leaveFullscreen() {
  if (typeof document.exitFullscreen === "function" && document.fullscreenElement !== null)
    void document.exitFullscreen().catch(() => undefined)
}

function enterFullscreen() {
  const root = document.documentElement
  if (typeof root.requestFullscreen === "function") void root.requestFullscreen().catch(() => undefined)
}

export function usePresent(deck: PresentDeck | null): Present {
  const [show, setShow] = useState<Show | null>(null)
  const [controls, setControls] = useState(false)
  const [clock, setClock] = useState<Clock>({ since: null, banked: 0 })
  const [now, setNow] = useState(0)
  const held = useRef<Show | null>(null)
  const latest = useRef(deck)
  const sleep = useRef<ReturnType<typeof setTimeout> | null>(null)
  const full = useRef(false)
  useEffect(() => {
    latest.current = deck
  })

  function place(next: Show | null) {
    held.current = next
    setShow(next)
  }

  function stop(at: number) {
    place(null)
    setControls(false)
    full.current = false
    leaveFullscreen()
    latest.current?.onLand(at)
  }

  function shown(): ShownDeck {
    return { count: latest.current?.count ?? 0, hidden: latest.current?.hidden ?? [] }
  }

  function step(key: ShowKey) {
    const before = held.current
    if (before === null) return
    const after = stepShow(before, key, shown())
    if (after === null) stop(before.at)
    else place(after)
  }

  function start(from: number) {
    const count = latest.current?.count ?? 0
    if (count === 0 || held.current !== null) return
    place(firstShow(Math.min(Math.max(0, from), count - 1)))
    const started = performance.now()
    setClock({ since: started, banked: 0 })
    setNow(started)
    enterFullscreen()
  }

  function wake() {
    setControls(true)
    if (sleep.current !== null) clearTimeout(sleep.current)
    sleep.current = setTimeout(() => setControls(false), idle)
  }

  const presenting = show !== null
  useEffect(() => {
    if (!presenting) return
    function listen(event: KeyboardEvent) {
      if (event.key === "Tab") return
      event.stopPropagation()
      const key = showKey(event)
      if (key === null) return
      event.preventDefault()
      step(key)
    }
    function fullscreen() {
      if (document.fullscreenElement !== null) full.current = true
      else if (full.current && held.current !== null) stop(held.current.at)
    }
    window.addEventListener("keydown", listen, true)
    document.addEventListener("fullscreenchange", fullscreen)
    return () => {
      window.removeEventListener("keydown", listen, true)
      document.removeEventListener("fullscreenchange", fullscreen)
      if (sleep.current !== null) clearTimeout(sleep.current)
    }
  }, [presenting])

  const ticking = show?.view === "presenter" && clock.since !== null
  useEffect(() => {
    if (!ticking) return
    const tick = setInterval(() => setNow(performance.now()), 1000)
    return () => clearInterval(tick)
  }, [ticking])

  return {
    show,
    controls,
    elapsed: secondsOf(clock, now),
    running: clock.since !== null,
    start,
    step,
    wake,
    pause: () => {
      const at = performance.now()
      setNow(at)
      setClock((last) => (last.since === null ? { ...last, since: at } : { since: null, banked: secondsOf(last, at) }))
    },
    restart: () => {
      const at = performance.now()
      setNow(at)
      setClock({ since: at, banked: 0 })
    },
  }
}
