import { toast } from "@/components/ui/toast"
import { moveDeck } from "@/decks/move-deck"
import { useFontReady } from "@/editor/use-font-ready"
import { storeNewer, watchNewer } from "@airdesign/live"
import { useSyncExternalStore } from "react"
import { NotFoundPage } from "@/decks/not-found-page"
import { DownloadedNotice, ThinNoticeView } from "@/thin-notice"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"
import { editableSlide } from "@/editor/editable-slide"
import { slideCommands } from "@/editor/slide-commands"
import { SlideToaster } from "@/editor/slide-toast"
import { useDeckOpen } from "@/editor/use-deck-open"
import { useKeptPanel } from "@/editor/kept-panel"
import { shownNotice } from "@/editor/use-deck-status"
import { useEditorDeck } from "@/editor/use-editor-deck"
import { useNetwork } from "@/editor/use-network"
import { useUndoTurn } from "@/editor/use-undo"
import { notesOn } from "@/present/notes-on"
import { showsIn } from "@/present/slide-shows"
export { elementIds, valueStorable } from "@/deck-paint"
import { AiraPanel } from "@/aira-panel"
import { colorsIn, LiveDesignPanel } from "@/editor/live-design-panel"

export function ThinDeck({ id }: { id: string }) {
  const deck = useEditorDeck(id)
  const paintedDeck = useFontReady(deck.paintedDeck)
  const [panel, setPanel] = useKeptPanel(id)
  useDeckOpen(deck)
  useNetwork(deck)
  const undoButtons = useUndoTurn(deck)
  const newer = useSyncExternalStore(watchNewer, storeNewer)
  const { shown, notesBar, exported } = deck
  const currentSlide = shown.store.current.slides()[shown.current]?.id

  if (newer) {
    return (
      <div className="thin-page" data-deck-refused>
        <ThinNoticeView notice="newer" onTryAgain={exported.tryAgain} />
        <EditorFrame fills>{null}</EditorFrame>
      </div>
    )
  }

  if (deck.refused) {
    return (
      <div className="thin-page" data-deck-refused>
        <NotFoundPage kind="deck" />
      </div>
    )
  }

  const notice = shownNotice({ ...deck, told: deck.undo.told, picture: deck.pictureTool.notice })

  return (
    <div className="thin-page" data-deck-ready={paintedDeck}>
      <ThinNoticeView notice={notice} onTryAgain={exported.tryAgain} />
      <SlideToaster list={deck.undo.undoList} />
      {exported.downloaded !== null && notice === null && (
        <DownloadedNotice name={exported.downloaded} onDone={() => exported.setDownloaded(null)} />
      )}
      <EditorFrame fills>
        <EditorShell
          deck={{
            id,
            selection: deck.selection,
            select: deck.select,
            onExport: exported.onExport,
            save: deck.save,
            undo: undoButtons,
            onText: deck.inserts.addText,
            onRename: deck.rename,
            onTrash: () =>
              void moveDeck({ deck: id, name: deck.title }, (pending) => {
                toast.dismiss(pending)
                window.location.assign("/")
              }),
            formatting: deck.undo.formatting.current,
            deckColors: colorsIn(shown.displayParts.current),
            onTable: deck.tables.insert,
            onPicture: deck.pictureTool.pick,
            onShape: deck.inserts.addShape,
            onIcon: deck.inserts.addIcon,
            size: shown.canvases.current(shown.current),
            slides: slideCommands(deck, undoButtons.onUndo),
            slide: editableSlide(deck),
            notesOf: (index) => notesOn(notesBar.notes, shown.store.current.slides()[index]?.id),
            shows: () =>
              showsIn(
                shown.shownParts.current,
                shown.store.current.slides().map((slide) => slide.id),
              ),
          }}
          notes={notesOn(notesBar.notes, currentSlide)}
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
