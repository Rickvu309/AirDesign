import { useId, useMemo, useSyncExternalStore } from "react"
import { toast } from "sonner"
import {
  openRegister,
  readTableValue,
  shapeOf,
  type ElementId,
  type SchemeName,
  type SetChange,
  type TraitReads,
} from "@airdesign/document"
import { readSlides, readTraits, shownFill, shownLine, themeSwatches, type DeckTraits } from "@airdesign/pptx"
import type { CommitOutcome } from "@/commit-edit"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { formatCopy } from "@/copy/format-copy"
import { panelOf, type PanelReads, type Swatch as PaletteSwatch } from "@/design/panel"
import { applyChange, deviceScope, valueFits, type ChangingDeck } from "@/design/trait-edit"
import { designShown, type DesignShown } from "@/design-shown"
import { BackgroundKind, DesignHead, DesignSection, ElementDesign, Swatch, SwatchButton } from "@/editor/design-panel"
import type { DeckPaint } from "@/editor/use-deck-paint"
import type { UndoList } from "@/editor/use-undo"
import { fileTableValue } from "@/table-edit"
import { structureOf } from "@/table-hook"
import type { UndoEntry } from "@/undo-list"

type Parts = ReadonlyMap<string, Uint8Array>

export type DesigningDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly undo: UndoList
  readonly designing: ElementId | null
  readonly record: (entry: UndoEntry) => void
  readonly settle: (outcome: CommitOutcome) => void
  readonly setPending: (pending: boolean) => void
}

const deckTraits = new WeakMap<Parts, DeckTraits | null>()

function readsOf(parts: Parts, node: ElementId): TraitReads {
  if (!deckTraits.has(parts)) {
    try {
      deckTraits.set(parts, readTraits(parts))
    } catch {
      deckTraits.set(parts, null)
    }
  }
  return deckTraits.get(parts)?.elements.get(node)?.reads ?? {}
}

function fieldsOf(parts: Parts, node: ElementId): PanelReads["fields"] {
  const { slide, shape } = shapeOf(node)
  const part = readSlides(parts).find((each) => each.slide === slide)?.part
  if (part === undefined) return {}
  try {
    const fill = shownFill(parts, { part, shape })
    const line = Object.entries(shownLine(parts, { part, shape }) ?? {}).map(([field, shown]) => [
      `line.${field}`,
      shown,
    ])
    return { ...(fill === null ? {} : { "fill.value": fill }), ...Object.fromEntries(line) }
  } catch {
    return {}
  }
}

function paletteOf(parts: Parts, index: number): readonly PaletteSwatch[] {
  const part = readSlides(parts)[index]?.part
  if (part === undefined) return []
  return themeSwatches(parts, part).map((swatch) => ({ ...swatch, name: formatCopy.colors[swatch.scheme] }))
}

function fileValue(shown: DeckPaint, node: ElementId): string | null {
  const shape = shown.shapes.current.get(node)
  return shape?.contentKind === "table" ? fileTableValue(shown.editParts.current, shape) : null
}

function changingDeck(deck: DesigningDeck): ChangingDeck {
  const { shown, undo } = deck
  return {
    id: deck.id,
    parts: () => shown.shownParts.current,
    floor: (node) => shown.boxes.current.get(node)?.file ?? shown.movables.current.get(node)?.file ?? "",
    file: (node) => fileValue(shown, node),
    fits: (node, value) => valueFits(shown.editParts.current, shown.shapes.current.get(node), value),
    hold: () => undo.records.current.hold(),
    record: deck.record,
    show: (register) => {
      if (shown.structure.current !== structureOf(register)) shown.showRegister(register)
      shown.repaint.current(register, "person")
      deck.setPending(true)
    },
  }
}

function changed(deck: DesigningDeck, change: SetChange) {
  deck.undo.turnAfter(async () => {
    const outcome = await applyChange(changingDeck(deck), change)
    if (outcome === "refused") toast.error(designCopy.refused)
    deck.settle(outcome)
  })
}

function LiveElementDesign({ deck, node }: { deck: DesigningDeck; node: ElementId }) {
  const { shown } = deck
  const { current } = shown
  const store = shown.store.current
  const text = useSyncExternalStore(store.elementSubscribe(node), () => store.getElement(node)?.text ?? null)
  const box = useSyncExternalStore(store.boxSubscribe(node), () => store.getBox(node))
  const parts = shown.shownParts.current
  const edited = shown.editParts.current
  const opening = deviceScope(parts, shown.shownRegister.current ?? openRegister("", "")).view(node)
  const palette = useMemo(() => paletteOf(edited, current), [edited, current])
  if (opening === undefined) return null
  const held = opening.value ?? fileValue(shown, node)
  const value = opening.facts.kind === "table" && readTableValue(text ?? "") === null ? held : (text ?? held)
  const view = { ...opening, value, box: box ?? opening.box }
  const model = panelOf(view, {
    reads: readsOf(edited, node),
    moves: shown.movables.current.has(node),
    fields: fieldsOf(shown.displayParts.current, node),
  })
  return (
    <ElementDesign
      model={model}
      kind={view.facts.kind}
      palette={palette}
      onChange={(row, value) => changed(deck, row.change(value))}
    />
  )
}

const lightest = 0xe0

function light(css: string): boolean {
  const hex = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(css)
  return hex !== null && hex.slice(1).every((pair) => Number.parseInt(pair, 16) >= lightest)
}

export function LiveDesignPanel({ deck }: { deck: DesigningDeck }) {
  const { shown, designing } = deck
  const elements = shown.store.current.slides()[shown.current]?.elements ?? []
  return designing !== null && elements.includes(designing) ? (
    <LiveElementDesign key={designing} deck={deck} node={designing} />
  ) : (
    <LiveSlideDesign deck={deck} />
  )
}

function LiveSlideDesign({ deck }: { deck: DesigningDeck }) {
  const { shown } = deck
  const parts = shown.displayParts.current
  const painted = shown.canvases.current(shown.current)?.background ?? null
  const view = useMemo(() => designShown(parts, shown.current, painted), [parts, shown.current, painted])
  if (view === null) return null
  return (
    <DesignView
      shown={view}
      onColor={(scheme) => changed(deck, { target: { slide: view.slide }, fill: { value: { solid: { scheme } } } })}
    />
  )
}

export function DesignView({ shown, onColor }: { shown: DesignShown; onColor: (scheme: SchemeName) => void }) {
  const heading = useId()
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-design-panel>
      <DesignHead>{designCopy.slide(shown.number)}</DesignHead>
      <DesignSection title={designCopy.template}>
        <p className="text-[length:var(--type-dense)] text-quiet">{designCopy.templateOff}</p>
      </DesignSection>
      <DesignSection title={designCopy.background}>
        <BackgroundKind color={designCopy.color}>
          <Button
            type="button"
            variant="ghost"
            disabled
            aria-label={designCopy.pictureOff}
            className="h-7 flex-1 rounded-[var(--shape-control)] text-xs font-normal text-quiet"
          >
            {designCopy.picture}
          </Button>
        </BackgroundKind>
        <Swatch color={shown.background.css} name={shown.background.name} edged={light(shown.background.css)} />
      </DesignSection>
      <DesignSection title={designCopy.colors} id={heading} last>
        <div role="group" aria-labelledby={heading} className="grid grid-cols-2 gap-2">
          {shown.colors.map((color) => (
            <SwatchButton
              key={color.scheme}
              color={color.css}
              name={color.name}
              edged={light(color.css)}
              pressed={color.chosen}
              onPick={() => {
                if (!color.chosen) onColor(color.scheme)
              }}
            />
          ))}
        </div>
      </DesignSection>
    </div>
  )
}
