import * as doom from "@airdesign/doom"
import { useEffect, useRef, useState } from "react"
import { NotesBar } from "@/editor/notes-bar"
import { notesOf, notesWrites } from "./deck-writes"
import type { EditorClient } from "./use-doom-deck"

const idle = 600

let sessions = 0

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
    const writes = notesWrites(latest.current.view, pending.slide, pending.text)
    latest.current.client.push(writes, step.current === null ? {} : { step: step.current })
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
