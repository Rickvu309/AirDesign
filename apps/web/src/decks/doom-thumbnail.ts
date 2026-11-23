import { httpDoomRemote, openDoomDeck } from "@airdesign/live"
import * as doom from "@airdesign/doom"
import { DoomSlide } from "@airdesign/render"
import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { slidesOf } from "@/editing/node-props"

export const thumbnailWidth = 640

const fontsWaitMilliseconds = 4000

const remote = httpDoomRemote()

async function doomAt(deck: string, rev: number): Promise<doom.Doom | null> {
  const opened = await openDoomDeck(remote, deck)
  if (!opened.ok) {
    const trashed = await remote.open({ deck, trashed: true })
    return trashed.ok ? trashed.fold : null
  }
  if (opened.deck.server().rev < rev) await opened.deck.catchUp()
  if (opened.deck.pending().length > 0) void opened.deck.sync()
  return opened.deck.view()
}

function paintMarkup(shown: doom.Doom, slide: doom.NodeId): Promise<string | null> {
  const host = document.createElement("div")
  const root = createRoot(host)
  root.render(createElement(DoomSlide, { doom: shown, slide, width: thumbnailWidth }))
  return new Promise((resolve) => {
    const started = Date.now()
    const settle = () => {
      const pending = host.querySelector("[data-fonts-pending]") !== null
      const drawn = host.firstElementChild !== null
      if (drawn && !pending) {
        const markup = host.innerHTML
        root.unmount()
        resolve(markup)
        return
      }
      if (Date.now() - started > fontsWaitMilliseconds) {
        root.unmount()
        resolve(null)
        return
      }
      setTimeout(settle, 30)
    }
    settle()
  })
}

async function paintOnce(deck: string, rev: number): Promise<string | null> {
  const shown = await doomAt(deck, rev)
  const slide = shown === null ? undefined : slidesOf(shown)[0]
  if (shown === null || slide === undefined) return null
  return paintMarkup(shown, slide)
}

export type Paint = (deck: string, rev: number) => Promise<string | null>

export function paintedOnce(paint: Paint): Paint {
  const held = new Map<string, Promise<string | null>>()
  let queue: Promise<unknown> = Promise.resolve()
  return (deck, rev) => {
    const key = `${deck}:${String(rev)}`
    const kept = held.get(key)
    if (kept !== undefined) return kept
    const next = queue.then(() => paint(deck, rev)).catch(() => null)
    queue = next
    const answer = next.then((markup) => {
      if (markup === null) held.delete(key)
      return markup
    })
    held.set(key, answer)
    return answer
  }
}

export const doomThumbnail = paintedOnce(paintOnce)
