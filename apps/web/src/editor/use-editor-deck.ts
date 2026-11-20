import { gestureFor, noSelection, type Selection } from "@airdesign/render"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { CellRange, ElementId } from "@airdesign/document"
import { flushMedia, keepMedia } from "@airdesign/live"
import { toast } from "@/components/ui/toast"
import { designCopy } from "@/copy/design-copy"
import { changeDesign } from "@/design/design-change"
import { selectionMatches } from "@/editor/matching-layers"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { deckInserts } from "@/editor/inserts"
import { storeLane } from "@/editor/store-lane"
import { useDeckPaint } from "@/editor/use-deck-paint"
import { saveStatus, useDeckStatus } from "@/editor/use-deck-status"
import { useDeckTitle } from "@/editor/use-deck-title"
import { useExport } from "@/editor/use-export"
import { useUndoList } from "@/editor/use-undo"
import { useNotes } from "@/notes-edit"
import { pickPicture } from "@/editor/picture-picker"
import { usePictureStore, usePictureTool } from "@/picture-tool"
import { useTables } from "@/table-hook"
import type { TableCells } from "@/editor/table-cells-section"

export type EditorDeck = ReturnType<typeof useEditorDeck>

export function useEditorDeck(id: string) {
  const status = useDeckStatus(id)
  const save = saveStatus(status)
  const { settle } = status
  const [title, setTitle] = useState("")
  const [selection, setSelection] = useState<Selection>(noSelection)
  const [matched, setMatched] = useState<readonly ElementId[]>([])
  const rename = useDeckTitle(id, title, setTitle)
  const undo = useUndoList()
  const { typed, sessions, records, record } = undo
  const pictures = { store: usePictureStore() }
  const notesBar = useNotes({ id, typed, sessions, records, record, settle })
  const shown = useDeckPaint(id, pictures, notesBar)
  const slides = shown.store.current.slides()
  const local = slides[shown.current]?.elements
  const matching =
    local !== undefined && selection.ids.some((node) => local.includes(node))
      ? matched.filter((node) => shown.shapes.current.has(node))
      : []

  function select(next: Selection) {
    setMatched([])
    setSelection(next)
  }

  const store = shown.store.current
  const at = shown.current
  const parts = shown.displayParts.current
  const register = shown.shownRegister.current
  const ids = selection.ids
  const matchable = useMemo(() => {
    try {
      return selectionMatches(parts, register, store.slides(), at, ids).length > 0
    } catch {
      return false
    }
  }, [parts, register, store, at, ids])

  function selectMatching() {
    try {
      const found = selectionMatches(parts, register, slides, at, ids)
      setMatched(found)
      if (found.length === 0) toast.message(designCopy.noMatching)
    } catch {
      toast.error(designCopy.refused)
    }
  }

  useMatchingShortcut(selection.ids.length > 0 ? selectMatching : undefined)

  const [lane] = useState(storeLane)
  const inserts = deckInserts({ id, shown, pictureTool: pictures, record, settle, lane })
  const pictureTool = usePictureTool(status.paintedDeck === id, pictures.store, inserts.addPicture)
  function placeImage(node: ElementId, file: File, paint: boolean) {
    pictureTool.pick(file, async (picture) => {
      try {
        const sha256 = await keepMedia(id, picture.bytes)
        pictures.store.keep(sha256, picture.bytes)
        const ref = `${picture.type}:${sha256}`
        changeDesign(
          { id, shown, undo, record, settle },
          () =>
            paint
              ? { target: { node }, fills: { paint: { image: ref } } }
              : { target: { node }, fills: { source: ref } },
          () => void flushMedia(id),
        )
      } catch {
        toast.error(designCopy.refused)
      }
    })
  }
  function replacePicture(node: ElementId, file: File) {
    placeImage(node, file, false)
  }
  function chooseFillImage(node: ElementId) {
    pickPicture((file) => placeImage(node, file, true))
  }
  const { changeElement, duplicateLayers, pasteLayers, pasteFromDeck, cutLayers } = inserts
  const tables = useTables(shown)
  const [tableCells, setTableCells] = useState<TableCells | null>(null)
  const onCells = useCallback((node: ElementId, cells: CellRange | null) => {
    setTableCells((now) => (cells !== null ? { node, cells } : now?.node === node ? null : now))
  }, [])
  const exported = useExport({ id, records, pictureTool, paint: shown.store, setFailure: status.setFailure })
  return {
    ...status,
    save: status.paintedDeck === id ? save : null,
    id,
    title,
    setTitle,
    selection,
    select,
    matching,
    matchable,
    selectMatching,
    replacePicture,
    chooseFillImage,
    rename,
    undo,
    record,
    pictureTool,
    notesBar,
    shown,
    inserts,
    placedText: inserts.placedText,
    changeElement,
    duplicateLayers,
    pasteLayers,
    pasteFromDeck,
    cutLayers,
    tables,
    tableCells,
    onCells,
    exported,
  }
}

function useMatchingShortcut(selectMatching: (() => void) | undefined) {
  useEffect(() => {
    if (selectMatching === undefined) return
    function match(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented) return
      if (gestureFor(event, "editor") !== "select-matching") return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select")))
        return
      if (!editorOwnsKey(event)) return
      event.preventDefault()
      selectMatching?.()
    }
    window.addEventListener("keydown", match)
    return () => window.removeEventListener("keydown", match)
  }, [selectMatching])
}
