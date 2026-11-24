import { gestureFor, type GestureId, type KeyLike } from "@/lib/gestures"
import { slideIndexOf } from "@/lib/slide-numbering"

export type ShowView = "audience" | "presenter"

export type Show = {
  readonly at: number
  readonly ended: boolean
  readonly typed: string
  readonly view: ShowView
}

export type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

export type ShowKey = "next" | "previous" | "first" | "last" | "go" | "erase" | "stop" | "presenter" | Digit

export type ShownDeck = { readonly count: number; readonly hidden: readonly boolean[] }

const showKeys: Partial<Readonly<Record<GestureId, ShowKey>>> = {
  "show-next": "next",
  "show-previous": "previous",
  "show-go": "go",
  "show-erase": "erase",
  "show-first": "first",
  "show-last": "last",
  "show-stop": "stop",
  "show-presenter": "presenter",
}

function isDigit(key: string): key is Digit {
  return /^[0-9]$/.test(key)
}

export function firstShow(at: number): Show {
  return { at, ended: false, typed: "", view: "audience" }
}

export function showKey(event: KeyLike): ShowKey | null {
  const gesture = gestureFor(event, "show")
  if (gesture === "show-number") return isDigit(event.key) ? event.key : null
  return gesture === null ? null : (showKeys[gesture] ?? null)
}

function shownFrom(deck: ShownDeck, from: number, by: 1 | -1): number | null {
  for (let index = from + by; index >= 0 && index < deck.count; index += by) {
    if (deck.hidden[index] !== true) return index
  }
  return null
}

export function nextShown(deck: ShownDeck, at: number): number | null {
  return shownFrom(deck, at, 1)
}

function next(show: Show, deck: ShownDeck): Show | null {
  if (show.ended) return null
  const to = shownFrom(deck, show.at, 1)
  return to === null ? { ...show, typed: "", ended: true } : { ...show, typed: "", at: to }
}

function previous(show: Show, deck: ShownDeck): Show {
  if (show.ended) return { ...show, typed: "", ended: false }
  return { ...show, typed: "", at: shownFrom(deck, show.at, -1) ?? show.at }
}

function go(show: Show, deck: ShownDeck): Show | null {
  if (show.typed === "") return next(show, deck)
  const asked = slideIndexOf(Number(show.typed), deck.count)
  if (asked === null) return { ...show, typed: "" }
  return { ...show, typed: "", ended: false, at: asked }
}

export function stepShow(show: Show, key: ShowKey, deck: ShownDeck): Show | null {
  if (isDigit(key)) {
    const typed = show.typed + key
    return typed.length > String(deck.count).length ? show : { ...show, typed }
  }
  if (key === "next") return next(show, deck)
  if (key === "previous") return previous(show, deck)
  if (key === "go") return go(show, deck)
  if (key === "erase") return show.typed === "" ? previous(show, deck) : { ...show, typed: show.typed.slice(0, -1) }
  if (key === "first") return { ...show, typed: "", ended: false, at: shownFrom(deck, -1, 1) ?? 0 }
  if (key === "last") return { ...show, typed: "", ended: false, at: shownFrom(deck, deck.count, -1) ?? show.at }
  if (key === "presenter") return { ...show, view: show.view === "audience" ? "presenter" : "audience" }
  return show.typed === "" ? null : { ...show, typed: "" }
}
