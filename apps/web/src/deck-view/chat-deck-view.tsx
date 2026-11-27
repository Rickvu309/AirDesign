import { useEffect, useMemo, useState } from "react"
import { AirdesignMark } from "@/components/ui/airdesign-mark"
import { deckViewCopy } from "@/copy/deck-view-copy"
import { connectChatHost, parentLine, type ChatHost, type Shown } from "./chat-host"
import { chatAssets, chatDoomRemote } from "./chat-remote"
import { DeckView, type Shell } from "./deck-view"

const quietHeight = 96

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
  const [shown, setShown] = useState<Shown | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    void connectChatHost(parentLine()).then((connected) => {
      if (live) setChat(connected)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => chat?.onShown(setShown), [chat])

  const remote = useMemo(() => (chat === null ? null : chatDoomRemote(chat)), [chat])
  const source = useMemo(() => (chat === null ? undefined : chatAssets(chat)), [chat])
  const shell = useMemo<Shell>(
    () =>
      chat === null
        ? {}
        : {
            openLink: chat.openLink,
            tellModel: chat.tellModel,
            fitHeight: (height) => chat.sizeTo({ width: Math.ceil(window.innerWidth), height }),
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
