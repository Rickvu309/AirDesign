import * as doom from "@airdesign/doom"
import { deckLocale } from "@airdesign/render"
import { useMemo, useSyncExternalStore } from "react"
import { Thumb } from "./thumb"

export type TypingPreview = {
  readonly writesOn: (slide: doom.NodeId) => readonly doom.Write[]
  readonly set: (writes: readonly doom.Write[], slide: doom.NodeId | undefined) => void
  readonly subscribe: (listener: () => void) => () => void
}

type Typed = { readonly writes: readonly doom.Write[]; readonly slide: doom.NodeId | undefined }

const author: doom.Author = { kind: "person", id: "preview" }

const followMilliseconds = 150

const none: readonly doom.Write[] = []
const idle: Typed = { writes: none, slide: undefined }

export function typingPreview(): TypingPreview {
  let latest = idle
  let shown = idle
  let timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const show = () => {
    timer = undefined
    if (shown === latest) return
    shown = latest
    for (const listener of listeners) listener()
  }
  return {
    writesOn: (slide) => (shown.slide === slide ? shown.writes : none),
    set: (writes, slide) => {
      if (writes.length === 0 && latest.writes.length === 0) return
      latest = writes.length === 0 || slide === undefined ? idle : { writes, slide }
      if (latest === idle) {
        clearTimeout(timer)
        show()
      } else timer ??= setTimeout(show, followMilliseconds)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function TypedThumb(props: {
  readonly typing: TypingPreview
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly width: number
  readonly assetUrl: (asset: string) => string | undefined
}) {
  const { typing, view, slide } = props
  const writes = useSyncExternalStore(typing.subscribe, () => typing.writesOn(slide))
  const shown = useMemo(() => {
    if (writes.length === 0) return view
    const shown = doom.viewOf(view, [{ once: "typing", author, writes }])
    const layer = writes.find(({ prop }) => prop === "text")?.node
    if (layer !== undefined) deckLocale(shown, { before: view, layer })
    return shown
  }, [view, writes])
  return <Thumb view={shown} slide={slide} width={props.width} assetUrl={props.assetUrl} />
}
