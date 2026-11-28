import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react"
import { AirdesignMark } from "@/components/ui/airdesign-mark"
import { deckViewCopy } from "@/copy/deck-view-copy"
import { connectChatHost, parentLine, type ChatHost, type HostContext, type HostState } from "./chat-host"
import { chatAssets, chatDoomRemote } from "./chat-remote"
import { DeckView, type Shell } from "./deck-view"

const quietHeight = 96

const unconnected: HostState = { shown: undefined, context: {} }
const stillUnconnected = () => unconnected
const nothingToWatch = () => () => undefined

function useHostLook({ theme, styles }: HostContext) {
  useLayoutEffect(() => {
    const root = document.documentElement
    if (theme !== undefined) root.dataset.hostTheme = theme
    const variables = Object.entries(styles?.variables ?? {})
    for (const [name, value] of variables) root.style.setProperty(name, value)
    return () => {
      delete root.dataset.hostTheme
      for (const [name] of variables) root.style.removeProperty(name)
    }
  }, [theme, styles])
}

function Opening() {
  return (
    <div className="h-dvh bg-canvas" aria-busy="true">
      <span className="sr-only">{deckViewCopy.opening}</span>
    </div>
  )
}

function NoDeck() {
  return (
    <div className="flex h-dvh items-center justify-center gap-2.5 bg-canvas px-6 text-sm text-muted-foreground">
      <AirdesignMark size={20} />
      {deckViewCopy.noDeck}
    </div>
  )
}

export function ChatDeckView() {
  const [chat, setChat] = useState<ChatHost | null>(null)

  useEffect(() => {
    let live = true
    void connectChatHost(parentLine()).then(
      (connected) => {
        if (live) setChat(connected)
      },
      (error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) throw error
      },
    )
    return () => {
      live = false
    }
  }, [])

  const { shown, context } = useSyncExternalStore(chat?.subscribe ?? nothingToWatch, chat?.state ?? stillUnconnected)
  useHostLook(context)

  const remote = useMemo(() => (chat === null ? null : chatDoomRemote(chat)), [chat])
  const source = useMemo(() => (chat === null ? undefined : chatAssets(chat)), [chat])
  const shell = useMemo<Shell>(
    () =>
      chat === null
        ? {}
        : {
            openLink: chat.openLink,
            fitHeight: (height) => chat.sizeTo({ width: Math.ceil(window.innerWidth), height }),
            closed: chat.closed,
            ...(chat.tellModel === undefined ? {} : { tellModel: chat.tellModel }),
          },
    [chat],
  )

  useEffect(() => {
    if (chat === null || shown !== null) return
    chat.sizeTo({ width: Math.ceil(window.innerWidth), height: quietHeight })
  }, [chat, shown])

  if (remote === null || shown === undefined) return <Opening />
  if (shown === null) return <NoDeck />
  return <DeckView key={shown.deck} id={shown.deck} slide={shown.slide} remote={remote} shell={shell} source={source} />
}
