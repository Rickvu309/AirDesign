import { dropChats, readChats, shelveChats, takeShelvedChats, writeChat } from "@airdesign/live"
import { useEffect, useRef, useState } from "react"
import type { AiraChat } from "@/aira-loop"
import {
  droppedChats,
  newestOfEach,
  readSavedChat,
  restoredChat,
  saveStep,
  savedChat,
  type SaveQueue,
  type SavedChat,
} from "@/aira-history"

export type ChatStore = {
  readonly list: (deck: string) => Promise<unknown[]>
  readonly put: (deck: string, chat: SavedChat) => Promise<void>
  readonly drop: (deck: string, ids?: readonly string[]) => Promise<void>
  readonly take: (deck: string) => unknown[]
  readonly shelve: (deck: string, chats: readonly SavedChat[]) => void
}

export const deviceChats: ChatStore = {
  list: readChats,
  put: writeChat,
  drop: dropChats,
  take: (deck) => takeShelvedChats(deck),
  shelve: (deck, chats) => shelveChats(deck, chats),
}

type Open = { readonly id: string; readonly started: number }

function newestFirst(chats: readonly SavedChat[]): readonly SavedChat[] {
  return [...chats].sort((one, two) => two.updated - one.updated)
}

export function useChatHistory({
  deck,
  now,
  mint,
  store,
  onRestore,
  empty,
}: {
  deck: string
  now: () => number
  mint: () => string
  store: ChatStore
  onRestore: (chat: AiraChat) => void
  empty: () => boolean
}) {
  const [chats, setChats] = useState<readonly SavedChat[]>([])
  const [openId, setOpenId] = useState("")
  const open = useRef<Open | null>(null)
  const queue = useRef<SaveQueue>({ writing: false, next: [] })
  const kept = useRef<readonly SavedChat[]>([])
  const unwritten = useRef(new Map<string, SavedChat>())
  const restore = useRef(onRestore)
  const isEmpty = useRef(empty)
  const keep = useRef<(chat: SavedChat) => void>(() => undefined)

  useEffect(() => {
    restore.current = onRestore
    isEmpty.current = empty
  })

  function opened(next: Open) {
    open.current = next
    setOpenId(next.id)
  }

  function listed(next: readonly SavedChat[]) {
    kept.current = newestFirst(next)
    setChats(kept.current)
  }

  function write(chat: SavedChat | null) {
    if (chat === null) return
    void store
      .put(deck, chat)
      .then(
        () => {
          if (unwritten.current.get(chat.id) === chat) unwritten.current.delete(chat.id)
        },
        () => undefined,
      )
      .then(() => {
        const step = saveStep(queue.current, { type: "written" })
        queue.current = step.queue
        write(step.write)
      })
  }

  function queued(chat: SavedChat) {
    unwritten.current.set(chat.id, chat)
    const step = saveStep(queue.current, { type: "changed", chat })
    queue.current = step.queue
    write(step.write)
  }

  useEffect(() => {
    keep.current = queued
  })

  useEffect(() => {
    const hide = () => store.shelve(deck, [...unwritten.current.values()])
    window.addEventListener("pagehide", hide)
    return () => window.removeEventListener("pagehide", hide)
  }, [deck, store])

  useEffect(() => {
    let live = true
    const readAll = (raw: readonly unknown[]) =>
      raw.flatMap((value) => {
        const chat = readSavedChat(value, deck)
        return chat === undefined ? [] : [chat]
      })
    void store
      .list(deck)
      .catch(() => [])
      .then((raw) => {
        if (!live) return
        const shelved = readAll(store.take(deck))
        const read = newestOfEach([...readAll(raw), ...shelved])
        for (const chat of read) if (shelved.includes(chat)) keep.current(chat)
        const newest = newestFirst(read)[0]
        kept.current = newestFirst([...read.filter((chat) => chat.id !== open.current?.id), ...kept.current])
        setChats(kept.current)
        if (newest !== undefined && open.current === null && isEmpty.current()) {
          opened({ id: newest.id, started: newest.started })
          restore.current(restoredChat(newest))
        }
      })
    return () => {
      live = false
    }
  }, [deck, store])

  function remember(chat: AiraChat) {
    if (chat.exchanges.length === 0) return
    const current = open.current ?? { id: mint(), started: now() }
    if (open.current === null) opened(current)
    const saved = savedChat(chat, { id: current.id, started: current.started, updated: now() })
    const dropped = droppedChats([saved, ...kept.current.filter((each) => each.id !== saved.id)], saved.id)
    listed([saved, ...kept.current.filter((each) => each.id !== saved.id && !dropped.includes(each.id))])
    for (const id of dropped) unwritten.current.delete(id)
    if (dropped.length > 0) void store.drop(deck, dropped).catch(() => undefined)
    queued(saved)
  }

  function start() {
    opened({ id: mint(), started: now() })
  }

  function pick(id: string): AiraChat | undefined {
    const found = kept.current.find((chat) => chat.id === id)
    if (found === undefined) return undefined
    opened({ id: found.id, started: found.started })
    return restoredChat(found)
  }

  const current = chats.find((chat) => chat.id === openId)
  return { chats, current, openId, remember, start, pick }
}
