import { type OrderKey } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { propOf } from "@airdesign/doom"
import { blankTextFor, draftWrites, holdsPaint, leaveWrites } from "./text-leave"
import {
  insertSlice,
  linkedWords,
  linkWords,
  baseOf,
  lookAt,
  markOn,
  typeInto,
  toggleMark,
  withMark,
  toggledList,
  withParagraphs,
  type Look,
  type Mark,
  type TextSlice,
} from "./text-edit"
import type { EditorClient } from "./use-deck"
import { refusedText, type Sent } from "./text-refused"
import { moved, noHistory, recorded, turned, type Changed, type Kept, type Run, type TextHistory } from "./text-history"

export type Created = {
  readonly id: doom.NodeId
  readonly parent: { readonly id: doom.NodeId; readonly at: OrderKey }
  readonly box: doom.Box
}

export type Entry =
  | { readonly kind: "all" }
  | { readonly kind: "end" }
  | { readonly kind: "point"; readonly x: number; readonly y: number }

export type Session = {
  readonly node: doom.NodeId
  readonly created: Created | null
  readonly keeps: boolean
  readonly draft: doom.Text
  readonly painted: doom.Text
  readonly saved: doom.Text
  readonly anchor: number
  readonly focus: number
  readonly pending: Look | null
  readonly sync: number
  readonly entry: Entry
}

export type TextSession = {
  readonly session: Session | null
  readonly refused: boolean
  readonly preview: readonly doom.Write[]
  begin(node: doom.NodeId, entry: Entry): void
  beginNew(created: Created, resize: doom.Text["resize"]): void
  replace(from: number, to: number, insert: string, run?: Run): void
  paste(from: number, to: number, slice: TextSlice): void
  mark(mark: Mark): void
  link(link: string | null): void
  align(align: NonNullable<doom.Para["align"]>): void
  list(kind: "bullet" | "number"): void
  indent(by: 1 | -1): void
  select(anchor: number, focus: number): void
  host(selected: (() => Caret | null) | null): void
  flush(): void
  finish(): void
  step(kind: "undo" | "redo"): void
}

export type Caret = { readonly anchor: number; readonly focus: number }

const idle = 700
const estimate = doom.measureWith({})

let sessions = 0

const empty = (resize: doom.Text["resize"]): doom.Text => ({ ...doom.textFromMarkdown("", "body"), resize })

const keptOf = ({ draft, anchor, focus }: Session): Kept => ({ draft, anchor, focus })

function creationWrites(created: Created, draft: doom.Text): readonly doom.Write[] {
  return [
    { node: created.id, prop: "type", value: "shape" },
    { node: created.id, prop: "parent", value: created.parent },
    { node: created.id, prop: "box", value: created.box },
    { node: created.id, prop: "text", value: draft },
  ]
}

export function useTextSession(client: EditorClient, view: doom.Doom, measure: doom.Measure | null): TextSession {
  const [session, setState] = useState<Session | null>(null)
  const ref = useRef<Session | null>(null)
  const pushed = useRef<string>("")
  const step = useRef("")
  const sent = useRef<Sent | null>(null)
  const reopened = useRef("")
  const [refused, setRefused] = useState(false)
  const notices = useSyncExternalStore(client.subscribe, client.notices)
  const selected = useRef<(() => Caret | null) | null>(null)
  const history = useRef<TextHistory>(noHistory)
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  })

  function set(next: Session | null) {
    const kept = next === null || next.draft.chars === "" ? next : { ...next, painted: next.draft }
    ref.current = kept
    setState(kept)
  }

  function live(): Session | null {
    const now = ref.current
    const at = selected.current?.() ?? null
    if (now === null || at === null || (now.anchor === at.anchor && now.focus === at.focus)) return now
    const next = { ...now, ...at, pending: null }
    history.current = moved(history.current)
    set(next)
    return next
  }

  function keep(once: string, draft: doom.Text, node: doom.NodeId) {
    const before = sent.current?.node === node ? sent.current.onces : []
    sent.current = { node, draft, onces: [...before, once] }
  }

  function flush() {
    const now = ref.current
    if (now === null) return
    const json = JSON.stringify(now.draft)
    if (json === pushed.current || (now.created !== null && now.draft.chars === "")) return
    const writes =
      now.created === null
        ? [{ node: now.node, prop: "text" as const, value: now.draft }]
        : creationWrites(now.created, now.draft)
    const done = client.push(writes, { step: step.current })
    if (!done.ok) return
    pushed.current = json
    if ("once" in done) keep(done.once, now.draft, now.node)
    if (now.created !== null) set({ ...now, created: null })
  }

  useEffect(() => {
    const found = refusedText(notices, sent.current)
    if (found === null) return
    sent.current = null
    const now = ref.current
    const json = JSON.stringify(found.draft)
    const open = now !== null && now.node === found.node
    if (!open && (now !== null || reopened.current === json || !viewRef.current.nodes.has(found.node))) return
    if (found.only) client.clearNotices()
    setRefused(true)
    if (open) {
      pushed.current = ""
      return
    }
    reopened.current = json
    begin(found.node, { kind: "end" })
    const opened = ref.current as Session | null
    if (opened === null) return
    pushed.current = json
    set({ ...opened, draft: found.draft, anchor: found.draft.chars.length, focus: found.draft.chars.length })
  }, [notices])

  function finish() {
    const now = ref.current
    if (now === null) return
    if (refused) pushed.current = ""
    if (now.keeps || now.draft.chars !== "") flush()
    if (now.created === null) {
      const { writes, seen } = leaveWrites(viewRef.current, {
        node: now.node,
        keeps: now.keeps,
        draft: now.draft,
        painted: now.painted,
        pushed: pushed.current,
      })
      client.push(writes, { step: step.current, seen })
    }
    setRefused(false)
    set(null)
  }

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    clearTimeout(timer.current)
    if (session === null) return
    timer.current = setTimeout(flush, idle)
    return () => clearTimeout(timer.current)
  }, [session?.draft])

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (ref.current !== null) finish()
    },
    [],
  )

  function begin(node: doom.NodeId, entry: Entry) {
    if (doom.linkedOwner(viewRef.current.nodes, node) !== undefined) return
    const keeps = holdsPaint(viewRef.current, node)
    const text = propOf(viewRef.current.nodes.get(node), "text") ?? blankTextFor(keeps)
    pushed.current = JSON.stringify(text)
    step.current = `text:${String((sessions += 1))}`
    history.current = noHistory
    const from = entry.kind === "all" ? 0 : text.chars.length
    set({
      node,
      created: null,
      keeps,
      draft: text,
      painted: text,
      saved: text,
      anchor: from,
      focus: text.chars.length,
      pending: null,
      sync: 1,
      entry,
    })
  }

  function beginNew(created: Created, resize: doom.Text["resize"]) {
    const text = empty(resize)
    pushed.current = JSON.stringify(text)
    step.current = `text:${String((sessions += 1))}`
    history.current = noHistory
    set({
      node: created.id,
      created,
      keeps: false,
      draft: text,
      painted: text,
      saved: text,
      anchor: 0,
      focus: 0,
      pending: null,
      sync: 1,
      entry: { kind: "end" },
    })
  }

  function change(next: Partial<Session> & { readonly draft: doom.Text }, changed: Changed | null = null) {
    const now = ref.current
    if (now === null) return
    if (next.draft !== now.draft)
      history.current = recorded(history.current, keptOf(now), changed, next.anchor ?? now.anchor)
    set({ ...now, ...next, sync: now.sync + 1 })
  }

  function turnText(kind: "undo" | "redo"): boolean {
    const now = ref.current
    const done = now === null ? null : turned(history.current, kind, keptOf(now))
    if (now === null || done === null) return false
    history.current = done.history
    set({ ...now, ...done.back, pending: null, sync: now.sync + 1 })
    return true
  }

  const sessionApi: TextSession = {
    session,
    refused,
    preview: useMemo(() => {
      if (session === null) return []
      if (session.created !== null) return creationWrites(session.created, session.draft)
      return draftWrites(view, session, measure ?? estimate)
    }, [session?.draft, session?.painted, session?.created, session?.node, session?.keeps, view, measure]),
    begin,
    beginNew,
    replace(from, to, insert, run) {
      const now = ref.current
      if (now === null) return
      const { text: draft, pending } = typeInto(now.draft, from, to, insert, now.pending)
      const caret = Math.min(from, to) + insert.length
      change({ draft, anchor: caret, focus: caret, pending }, { from, to, run })
    },
    paste(from, to, slice) {
      const now = ref.current
      if (now === null) return
      const draft = insertSlice(now.draft, from, to, slice)
      const caret = Math.min(from, to) + slice.chars.length
      change({ draft, anchor: caret, focus: caret, pending: null }, { from, to })
    },
    mark(mark) {
      const now = live()
      if (now === null) return
      const [low, high] = [Math.min(now.anchor, now.focus), Math.max(now.anchor, now.focus)]
      if (low === high) {
        const base = now.pending ?? lookAt(now.draft, low)
        const face = baseOf(now.draft, doom.deckOf(viewRef.current).theme)
        const on = markOn(now.draft, low, high, mark, face, now.pending ?? undefined)
        change({ draft: now.draft, pending: withMark(base, mark, !on, face) })
        return
      }
      change({ draft: toggleMark(now.draft, low, high, mark, baseOf(now.draft, doom.deckOf(viewRef.current).theme)) })
    },
    link(link) {
      const now = live()
      const words = now === null ? null : linkedWords(now.draft, now.anchor, now.focus)
      if (now === null || words === null) return
      change({ draft: linkWords(now.draft, words.from, words.to, link) })
    },
    align(align) {
      const now = live()
      if (now === null) return
      change({ draft: withParagraphs(now.draft, now.anchor, now.focus, (para) => ({ ...para, align })) })
    },
    list(kind) {
      const now = live()
      if (now !== null) change({ draft: toggledList(now.draft, now.anchor, now.focus, kind) })
    },
    indent(by) {
      const now = live()
      if (now === null) return
      const draft = withParagraphs(now.draft, now.anchor, now.focus, (para) => {
        if (para.list === undefined) return para
        const level = Math.max(0, Math.min(4, (para.level ?? 0) + by))
        const { level: _level, ...rest } = para
        return level === 0 ? rest : { ...rest, level }
      })
      change({ draft })
    },
    select(anchor, focus) {
      const now = ref.current
      if (now === null || (now.anchor === anchor && now.focus === focus)) return
      history.current = moved(history.current)
      set({ ...now, anchor, focus, pending: null })
    },
    host(read) {
      selected.current = read
    },
    flush,
    finish,
    step(kind) {
      if (turnText(kind) || kind === "redo") return
      flush()
      set(null)
      client.undo()
    },
  }
  return sessionApi
}
