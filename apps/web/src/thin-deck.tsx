import { shapeOf, slideNode, type ElementId } from "@airdesign/document"
import { changeDesign } from "@/design/design-change"
import { PresentLinks } from "@/present/present-links"
import { slideRulers } from "@/editor/slide-rulers"
import { toast } from "@/components/ui/toast"
import { moveDeck } from "@/decks/move-deck"
import { connect, storeNewer, watchNewer } from "@airdesign/live"
import { useRef, useState, useSyncExternalStore } from "react"
import { NotFoundPage } from "@/decks/not-found-page"
import { ThinNoticeView } from "@/thin-notice"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"
import { editableSlide } from "@/editor/editable-slide"
import { slideCommands } from "@/editor/slide-commands"
import { useDeckOpen } from "@/editor/use-deck-open"
import { useFindingsReport } from "@/editor/use-findings-report"
import { useKeptPanel } from "@/editor/kept-panel"
import { shownNotice } from "@/editor/use-deck-status"
import { useDesignKeys } from "@/editor/design-keys"
import { selectionFocus, useKeysBackToCanvas } from "@/editor/keys-back-to-canvas"
import { SlideEyedropper, useDeckEyedropper } from "@/editor/eyedropper-tool"
import { useEditorDeck } from "@/editor/use-editor-deck"
import { useNetwork } from "@/editor/use-network"
import { useUndoTurn } from "@/editor/use-undo"
import { notesOn } from "@/present/notes-on"
import { layerPairs, showsIn } from "@/present/slide-shows"
export { elementIds, valueStorable } from "@/deck-paint"
import { AiraPanel } from "@/aira/aira-panel"
import { server } from "@/commit-edit"
import { colorsIn } from "@/editor/deck-colors"
import { LiveDesignPanel } from "@/editor/live-design-panel"
import { LiveLayers } from "@/editor/live-layers"
import type { RenameRequest } from "@/editor/layers-panel"
import { useLayerKeys } from "@/editor/layer-keys"
import { toggleLayerFlag } from "@/editor/layer-flags"
import { maskAction } from "@/editor/mask-action"
import { toneLink } from "@/editor/tone-link"
import { toneScope } from "@/editor/tone-scope"
import { useSettled } from "@airdesign/render"

import type { PanelMode } from "@/design/panel-order"

export function ThinDeck({ id }: { id: string }) {
  const deck = useEditorDeck(id)
  const [selectedSlides, setSelectedSlides] = useState<readonly number[]>([])
  const [panel, setPanel] = useKeptPanel(id)
  const [mode, setMode] = useState<PanelMode>("slides")
  const [hovered, setHovered] = useState<ElementId | null>(null)
  const [renameRequest, setRenameRequest] = useState<RenameRequest | null>(null)
  const renameCount = useRef(0)
  const [tone] = useState(toneLink)
  useDeckOpen(deck)
  useNetwork(deck)
  useFindingsReport(id, deck.shown.shownParts, deck.openedDeck === id, deck.pictureTool.store)
  const undoButtons = useUndoTurn(deck)
  const newer = useSyncExternalStore(watchNewer, storeNewer)
  const settled = useSettled()
  const { shown, notesBar, exported } = deck
  const currentSlide = shown.store.current.slides()[shown.current]?.id
  const currentCanvas = shown.canvases.current(shown.current)
  function startLayerRename(): boolean {
    if (currentCanvas === null || currentSlide === undefined) return false
    const present = new Set([
      ...currentCanvas.elements.flatMap((each) => (each.id === null ? [] : [each.id])),
      ...(currentCanvas.unpainted ?? []),
    ])
    for (let at = deck.selection.ids.length - 1; at >= 0; at -= 1) {
      const node = deck.selection.ids[at]
      if (node !== undefined && present.has(node) && shapeOf(node).slide === currentSlide) {
        setMode("design")
        renameCount.current += 1
        setRenameRequest({ node, at: renameCount.current })
        return true
      }
    }
    return false
  }
  const designing = { ...deck, selectedSlides }
  useDesignKeys(designing, deck.paintedDeck === id)
  useKeysBackToCanvas(deck.paintedDeck === id, () => selectionFocus(currentCanvas, deck.selection))
  const eyedropper = useDeckEyedropper(designing, deck.paintedDeck === id)
  useLayerKeys(deck.paintedDeck === id, {
    onFlag: (flag) => toggleLayerFlag(deck, deck.selection.ids, flag),
    onRename: startLayerRename,
    onMask: () => {
      const action = maskAction(deck.selection.ids, currentCanvas?.elements ?? [])
      if (action?.kind === "toggle") toggleLayerFlag(deck, [action.node], "mask")
      if (action?.kind === "group") void deck.inserts.changeElement(action.change)
    },
  })

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

  const strip = slideCommands(deck)
  const shows = showsIn(shown.displayParts.current, strip.slideIds ?? [])

  return (
    <div
      className="thin-page"
      data-deck-ready={deck.paintedDeck === id && deck.openedDeck === id && settled && !deck.painting ? id : undefined}
    >
      <ThinNoticeView notice={notice} onTryAgain={exported.tryAgain} />
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
            onSlideNumber: deck.inserts.addSlideNumber,
            onRename: deck.rename,
            onTrash: () =>
              void moveDeck({ deck: id, name: deck.title }, (pending) => {
                toast.dismiss(pending)
                window.location.assign("/")
              }),
            formatting: deck.undo.formatting.current,
            tone: { link: tone, scope: (node) => toneScope(shown, [node]) },
            deckColors: colorsIn(shown.displayParts.current),
            onPicture: deck.pictureTool.pick,
            onShape: deck.inserts.addShape,
            onIcon: deck.inserts.addIcon,
            size: shown.canvases.current(shown.current),
            slides: {
              ...strip,
              onSelection: setSelectedSlides,
              skipped: shows.map((show) => show.hidden),
              onSkip: (indices, skipped) => {
                const slides = indices.flatMap((index) => {
                  const slide = strip.slideIds?.[index]
                  return slide === undefined || shows[index]?.hidden === skipped ? [] : [slide]
                })
                if (slides.length === 0) return
                changeDesign(deck, () =>
                  slides.map((slide) => ({ target: { node: slideNode(slide, "slide") }, show: { skipped } })),
                )
              },
            },
            slide: editableSlide({ ...deck, hovered: mode === "design" ? hovered : null }),
            rulers: slideRulers(deck),
            displayed: deck.shown.displayed,
            layers: (
              <LiveLayers
                deck={deck}
                onHover={setHovered}
                rename={renameRequest}
                onRenameStarted={() => setRenameRequest(null)}
              />
            ),
            presentPaint: (index, width, go) => (
              <PresentLinks parts={shown.displayParts.current} index={index} width={width} go={go}>
                {slideCommands(deck, false).thumb(index, width)}
              </PresentLinks>
            ),
            notesOf: (index) => notesOn(notesBar.notes, shown.store.current.slides()[index]?.id),
            morphOf: (from, to) => {
              const slides = shown.store.current.slides()
              return layerPairs(shown.displayParts.current, slides[from]?.id, slides[to]?.id)
            },
            shows: () =>
              showsIn(
                shown.displayParts.current,
                shown.store.current.slides().map((slide) => slide.id),
              ),
          }}
          notes={notesOn(notesBar.notes, currentSlide)}
          onNotes={(value) => notesBar.edit(currentSlide, value)}
          panel={panel}
          onPanel={setPanel}
          designMode={{ value: mode, onChange: setMode }}
          side={(selectedCount) => (
            <AiraPanel
              key={id}
              deck={id}
              toneLink={tone}
              hidden={panel !== "agent"}
              online={deck.online}
              opened={() => connect(server).open(id)}
              showAgent={() => setPanel("agent")}
              design={(toneFor) =>
                panel === "design" ? (
                  <LiveDesignPanel
                    deck={{ ...deck, selectedSlides }}
                    selectedSlides={selectedCount}
                    mode={mode}
                    onMode={setMode}
                    toneFor={toneFor}
                  />
                ) : null
              }
            />
          )}
          overlay={<SlideEyedropper state={eyedropper} />}
          slideLabel={String(shown.current + 1)}
          title={deck.title}
        />
      </EditorFrame>
    </div>
  )
}
