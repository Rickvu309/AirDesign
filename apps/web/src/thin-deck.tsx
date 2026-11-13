import { useState } from "react"
import { DownloadedNotice, ThinNoticeView } from "@/thin-notice"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"
import { editableSlide } from "@/editor/editable-slide"
import { deckInserts } from "@/editor/inserts"
import { slideCommands } from "@/editor/slide-commands"
import { useDeckOpen } from "@/editor/use-deck-open"
import { useDeckPaint } from "@/editor/use-deck-paint"
import { shownNotice, useDeckStatus } from "@/editor/use-deck-status"
import { useDeckTitle } from "@/editor/use-deck-title"
import { useExport } from "@/editor/use-export"
import { useNetwork } from "@/editor/use-network"
import { useUndoList, useUndoTurn } from "@/editor/use-undo"
import { usePictureTool } from "@/picture-tool"
export { elementIds, valueStorable } from "@/deck-paint"
import { AiraPanel } from "@/aira-panel"
import { airaStarters } from "@/aira-starters"
import { useTables } from "@/table-hook"
import { useNotes } from "@/notes-edit"

export function ThinDeck({ id }: { id: string }) {
  const status = useDeckStatus()
  const { paintedDeck, settle, setPending } = status
  const [title, setTitle] = useState("")
  const rename = useDeckTitle(id, title, setTitle)
  const [panel, setPanel] = useState<"agent" | "design">("agent")
  const undo = useUndoList()
  const { typed, sessions, records, record } = undo
  const pictureTool = usePictureTool(paintedDeck === id, (picture) => inserts.addPicture(picture))
  const notesBar = useNotes({ id, typed, sessions, records, record, settle, sending: () => setPending(true) })
  const shown = useDeckPaint(id, pictureTool, notesBar, setPending)
  const { store, shapes, editParts, canvases, current } = shown
  useDeckOpen({ ...status, id, shown, notesBar, setTitle })
  useNetwork(id, settle, status.leftNetwork)
  const undoButtons = useUndoTurn({ id, working: paintedDeck === id, undo, shown, notesBar, settle, setPending })
  const inserts = deckInserts({ id, shown, pictureTool, record, settle })
  const { changeElement } = inserts
  const { showEdited } = shown
  const tables = useTables({ current, store, shapes, editParts, canvases, showEdited, changeElement })
  const exported = useExport({ id, records, pictureTool, setFailure: status.setFailure })

  const currentSlide = store.current.slides()[current]?.id
  const currentNotes = notesBar.notes.find((notes) => notes.slide === currentSlide)

  if (status.refused) {
    return (
      <div className="thin-page" data-deck-refused>
        <ThinNoticeView notice="import-failed" onTryAgain={exported.tryAgain} />
        <EditorFrame>{null}</EditorFrame>
      </div>
    )
  }

  const notice = shownNotice({ ...status, told: undo.told, picture: pictureTool.notice })

  return (
    <div className="thin-page" data-deck-ready={paintedDeck}>
      <ThinNoticeView notice={notice} onTryAgain={exported.tryAgain} />
      {exported.downloaded !== null && notice === null && (
        <DownloadedNotice name={exported.downloaded} onDone={() => exported.setDownloaded(null)} />
      )}
      <EditorFrame>
        <EditorShell
          deck={{
            onExport: exported.onExport,
            undo: undoButtons,
            onText: inserts.addText,
            onRename: rename,
            formatting: undo.formatting.current,
            onTable: tables.insert,
            onPicture: pictureTool.pick,
            onShape: inserts.addShape,
            size: canvases.current(current),
            slides: slideCommands({ id, shown, record, settle }),
            slide: editableSlide({ id, shown, undo, tables, settle, setPending, changeElement }),
          }}
          notes={currentNotes?.text ?? ""}
          onNotes={(value) => notesBar.edit(currentSlide, value)}
          panel={panel}
          onPanel={setPanel}
          side={
            <AiraPanel key={id} deck={id} starters={() => airaStarters(store.current)} hidden={panel !== "agent"} />
          }
          slideLabel={String(current + 1)}
          title={title}
        />
      </EditorFrame>
    </div>
  )
}
