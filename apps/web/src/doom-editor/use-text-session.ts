import { type OrderKey } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { useEffect, useMemo, useRef, useState } from "react"
import { propOf } from "./node-props"
import { blankTextFor, holdsPaint, leaveEmptyWrites } from "./text-leave"
import {
  lookAt,
  markOn,
  replaceRange,
  toggleMark,
  toggledList,
  withParagraphs,
  type Look,
  type Mark,
} from "./text-edit"
import { styleWrite } from "./design-text-values"
import type { EditorClient } from "./use-doom-deck"

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
  readonly saved: doom.Text
  readonly anchor: number
  readonly focus: number
  readonly pending: Look | null
  readonly sync: number
  readonly entry: Entry
}

export type TextSession = {
  readonly session: Session | null
  readonly preview: readonly doom.Write[]
  begin(node: doom.NodeId, entry: Entry): void
  beginNew(created: Created, resize: doom.Text["resize"]): void
  replace(from: number, to: number, insert: string): void
  mark(mark: Mark): void
  align(align: NonNullable<doom.Para["align"]>): void
  list(kind: "bullet" | "number"): void
  indent(by: 1 | -1): void
  setStyle(style: doom.TextStyleName): void
  select(anchor: number, focus: number): void
  flush(): void
  finish(): void
  step(kind: "undo" | "redo"): void
}

const idle = 700

const empty = (resize: doom.Text["resize"]): doom.Text => ({ ...doom.textFromMarkdown("", "body"), resize })

function creationWrites(created: Created, draft: doom.Text): readonly doom.Write[] {
  return [
    { node: created.id, prop: "type", value: "shape" },
    { node: created.id, prop: "parent", value: created.parent },
    { node: created.id, prop: "box", value: created.box },
    { node: created.id, prop: "text", value: draft },
  ]
}

export function useTextSession(client: EditorClient, view: doom.Doom): TextSession {
  const [session, setState] = useState<Session | null>(null)
  const ref = useRef<Session | null>(null)
  const pushed = useRef<string>("")
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  })

  function set(next: Session | null) {
    ref.current = next
    setState(next)
  }

  function flush() {
    const now = ref.current
    if (now === null) return
    const json = JSON.stringify(now.draft)
    if (json === pushed.current || now.draft.chars === "") return
    if (now.created !== null) {
      if (client.push(creationWrites(now.created, now.draft)).ok) {
        pushed.current = json
        set({ ...now, created: null })
      }
      return
    }
    if (client.push([{ node: now.node, prop: "text", value: now.draft }]).ok) pushed.current = json
  }

  function finish() {
    const now = ref.current
    if (now === null) return
    flush()
    if (now.created === null) {
      const writes = leaveEmptyWrites({ node: now.node, keeps: now.keeps, draft: now.draft, pushed: pushed.current })
      if (writes.length > 0) client.push(writes)
    }
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
    const keeps = holdsPaint(viewRef.current, node)
    const text = propOf(viewRef.current.nodes.get(node), "text") ?? blankTextFor(keeps)
    pushed.current = JSON.stringify(text)
    const from = entry.kind === "all" ? 0 : text.chars.length
    set({
      node,
      created: null,
      keeps,
      draft: text,
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
    set({
      node: created.id,
      created,
      keeps: false,
      draft: text,
      saved: text,
      anchor: 0,
      focus: 0,
      pending: null,
      sync: 1,
      entry: { kind: "end" },
    })
  }

  function change(next: Partial<Session> & { readonly draft: doom.Text }) {
    const now = ref.current
    if (now !== null) set({ ...now, ...next, sync: now.sync + 1 })
  }

  const sessionApi: TextSession = {
    session,
    preview: useMemo(() => {
      if (session === null) return []
      return session.created === null
        ? [{ node: session.node, prop: "text" as const, value: session.draft }]
        : creationWrites(session.created, session.draft)
    }, [session?.draft, session?.created, session?.node]),
    begin,
    beginNew,
    replace(from, to, insert) {
      const now = ref.current
      if (now === null) return
      const collapsed = from === to && now.pending !== null
      const draft = replaceRange(now.draft, from, to, insert, collapsed ? (now.pending ?? undefined) : undefined)
      const caret = Math.min(from, to) + insert.length
      change({ draft, anchor: caret, focus: caret, pending: null })
    },
    mark(mark) {
      const now = ref.current
      if (now === null) return
      const [low, high] = [Math.min(now.anchor, now.focus), Math.max(now.anchor, now.focus)]
      if (low === high) {
        const base = now.pending ?? lookAt(now.draft, low)
        const on = markOn(now.draft, low, high, mark, now.pending ?? undefined)
        const { [mark]: _was, ...rest } = base
        change({ draft: now.draft, pending: on ? rest : { ...base, [mark]: true } })
        return
      }
      change({ draft: toggleMark(now.draft, low, high, mark) })
    },
    align(align) {
      const now = ref.current
      if (now === null) return
      change({ draft: withParagraphs(now.draft, now.anchor, now.focus, (para) => ({ ...para, align })) })
    },
    list(kind) {
      const now = ref.current
      if (now !== null) change({ draft: toggledList(now.draft, now.anchor, now.focus, kind) })
    },
    indent(by) {
      const now = ref.current
      if (now === null) return
      const draft = withParagraphs(now.draft, now.anchor, now.focus, (para) => {
        if (para.list === undefined) return para
        const level = Math.max(0, Math.min(4, (para.level ?? 0) + by))
        const { level: _level, ...rest } = para
        return level === 0 ? rest : { ...rest, level }
      })
      change({ draft })
    },
    setStyle(style) {
      const now = ref.current
      if (now !== null) change({ draft: styleWrite(now.draft, style) })
    },
    select(anchor, focus) {
      const now = ref.current
      if (now === null || (now.anchor === anchor && now.focus === focus)) return
      set({ ...now, anchor, focus, pending: null })
    },
    flush,
    finish,
    step(kind) {
      flush()
      set(null)
      if (kind === "undo") client.undo()
      else client.redo()
    },
  }
  return sessionApi
}
