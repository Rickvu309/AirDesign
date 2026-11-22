import { httpSceneRemote, openSceneDeck } from "@airdesign/live"
import { scene } from "@airdesign/document"
import { SceneSlide } from "@airdesign/render"
import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { slidesOf } from "@/scene-editor/node-props"

export const thumbnailWidth = 640

const fontsWaitMilliseconds = 4000

const remote = httpSceneRemote()

async function sceneAt(deck: string, rev: number): Promise<scene.Scene | null> {
  const opened = await openSceneDeck(remote, deck)
  if (!opened.ok) return null
  if (opened.deck.server().rev < rev) await opened.deck.catchUp()
  if (opened.deck.pending().length > 0) void opened.deck.sync()
  return opened.deck.view()
}

function paintMarkup(shown: scene.Scene, slide: scene.NodeId): Promise<string | null> {
  const host = document.createElement("div")
  const root = createRoot(host)
  root.render(createElement(SceneSlide, { scene: shown, slide, width: thumbnailWidth }))
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
  const shown = await sceneAt(deck, rev)
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

export const sceneThumbnail = paintedOnce(paintOnce)
