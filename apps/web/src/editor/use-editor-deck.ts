import { leadOf, noSelection, type Selection } from "@airdesign/render"
import { useState } from "react"
import { deckInserts } from "@/editor/inserts"
import { useDeckPaint } from "@/editor/use-deck-paint"
import { saveStatus, useDeckStatus } from "@/editor/use-deck-status"
import { useShownSave } from "@/editor/save-status"
import { useDeckTitle } from "@/editor/use-deck-title"
import { useExport } from "@/editor/use-export"
import { useUndoList } from "@/editor/use-undo"
import { useNotes } from "@/notes-edit"
import { usePictureStore, usePictureTool } from "@/picture-tool"
import { useTables } from "@/table-hook"

export type EditorDeck = ReturnType<typeof useEditorDeck>

export function useEditorDeck(id: string) {
  const status = useDeckStatus()
  const save = useShownSave(saveStatus(status))
  const { settle, setPending } = status
  const [title, setTitle] = useState("")
  const [selection, select] = useState<Selection>(noSelection)
  const rename = useDeckTitle(id, title, setTitle)
  const undo = useUndoList()
  const { typed, sessions, records, record } = undo
  const pictures = { store: usePictureStore() }
  const notesBar = useNotes({ id, typed, sessions, records, record, settle, sending: () => setPending(true) })
  const shown = useDeckPaint(id, pictures, notesBar)
  const inserts = deckInserts({ id, shown, pictureTool: pictures, record, settle, setPending })
  const pictureTool = usePictureTool(status.paintedDeck === id, pictures.store, inserts.addPicture)
  const { current, store, shapes, editParts, canvases, showEdited } = shown
  const { changeElement } = inserts
  const tables = useTables({ current, store, shapes, editParts, canvases, showEdited, changeElement })
  const exported = useExport({ id, records, pictureTool, setFailure: status.setFailure })
  return {
    ...status,
    save: status.paintedDeck === id ? save : null,
    id,
    title,
    setTitle,
    selection,
    designing: leadOf(selection),
    select,
    rename,
    undo,
    record,
    pictureTool,
    notesBar,
    shown,
    inserts,
    changeElement,
    tables,
    exported,
  }
}
