import * as doom from "@airdesign/doom"
import { useEffect, useRef, useState } from "react"
import { NotesBar } from "@/editor/notes-bar"
import { intentWrites } from "./editor-intents"
import type { EditorClient } from "./use-deck"

const idle = 600

let sessions = 0

function notesOf(view: doom.Doom, slide: doom.NodeId): string {
  return doom.propOf(view.nodes.get(slide), "notes")?.chars ?? ""
}

type Draft = { readonly slide: doom.NodeId; readonly text: string }

export function DoomNotes(props: {
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly slide: doom.NodeId
}) {
  const { client, view, slide } = props
  const [draft, setDraft] = useState<Draft | null>(null)
  const held = useRef<Draft | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const step = useRef<string | null>(null)
  const latest = useRef({ client, view })
  useEffect(() => {
    latest.current = { client, view }
  })

  function commit() {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    const pending = held.current
    held.current = null
    if (pending === null) return
    const { view: now, client: deck } = latest.current
    const changed = now.nodes.get(pending.slide)?.type === "slide" && pending.text !== notesOf(now, pending.slide)
    const made = changed ? intentWrites(now, [{ op: "update", target: pending.slide, notes: pending.text }]) : null
    if (made !== null) deck.push(made.writes, step.current === null ? {} : { step: step.current })
    setDraft((now) => (now === pending ? null : now))
  }

  function leave() {
    commit()
    step.current = null
  }

  useEffect(() => leave, [slide])

  function edit(text: string) {
    const next = { slide, text }
    step.current ??= `notes:${String((sessions += 1))}`
    held.current = next
    setDraft(next)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(commit, idle)
  }

  return (
    <div onBlur={leave}>
      <NotesBar text={draft !== null && draft.slide === slide ? draft.text : notesOf(view, slide)} onEdit={edit} />
    </div>
  )
}
