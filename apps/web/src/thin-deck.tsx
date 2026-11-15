import { storeNewer, watchNewer } from "@airdesign/live"
import { useState, useSyncExternalStore } from "react"
import { DownloadedNotice, ThinNoticeView } from "@/thin-notice"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"
import { editableSlide } from "@/editor/editable-slide"
import { slideCommands } from "@/editor/slide-commands"
import { useDeckOpen } from "@/editor/use-deck-open"
import { shownNotice } from "@/editor/use-deck-status"
import { useEditorDeck } from "@/editor/use-editor-deck"
import { useNetwork } from "@/editor/use-network"
import { useUndoTurn } from "@/editor/use-undo"
export { elementIds, valueStorable } from "@/deck-paint"
import { AiraPanel } from "@/aira-panel"
import { LiveDesignPanel } from "@/editor/live-design-panel"

export function ThinDeck({ id }: { id: string }) {
  const deck = useEditorDeck(id)
  const [panel, setPanel] = useState<"agent" | "design">("agent")
  useDeckOpen(deck)
  useNetwork(deck)
  const undoButtons = useUndoTurn(deck)
  const newer = useSyncExternalStore(watchNewer, storeNewer)
  const { shown, notesBar, exported } = deck
  const currentSlide = shown.store.current.slides()[shown.current]?.id
  const currentNotes = notesBar.notes.find((notes) => notes.slide === currentSlide)

  if (deck.refused || newer) {
    return (
      <div className="thin-page" data-deck-refused>
        <ThinNoticeView notice={newer ? "newer" : "import-failed"} onTryAgain={exported.tryAgain} />
        <EditorFrame>{null}</EditorFrame>
      </div>
    )
  }

  const notice = shownNotice({ ...deck, told: deck.undo.told, picture: deck.pictureTool.notice })

  return (
    <div className="thin-page" data-deck-ready={deck.paintedDeck}>
      <ThinNoticeView notice={notice} onTryAgain={exported.tryAgain} />
      {exported.downloaded !== null && notice === null && (
        <DownloadedNotice name={exported.downloaded} onDone={() => exported.setDownloaded(null)} />
      )}
      <EditorFrame>
        <EditorShell
          deck={{
            onExport: exported.onExport,
            undo: undoButtons,
            onText: deck.inserts.addText,
            onRename: deck.rename,
            formatting: deck.undo.formatting.current,
            onTable: deck.tables.insert,
            onPicture: deck.pictureTool.pick,
            onShape: deck.inserts.addShape,
            onIcon: deck.inserts.addIcon,
            size: shown.canvases.current(shown.current),
            slides: slideCommands(deck),
            slide: editableSlide(deck),
          }}
          notes={currentNotes?.text ?? ""}
          onNotes={(value) => notesBar.edit(currentSlide, value)}
          panel={panel}
          onPanel={setPanel}
          side={
            <>
              {panel === "design" ? <LiveDesignPanel deck={deck} /> : null}
              <AiraPanel key={id} deck={id} hidden={panel !== "agent"} />
            </>
          }
          slideLabel={String(shown.current + 1)}
          title={deck.title}
        />
      </EditorFrame>
    </div>
  )
}
