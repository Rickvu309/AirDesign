import { useId, useMemo, useSyncExternalStore, type ReactNode } from "react"
import {
  openRegister,
  readTableValue,
  shapeOf,
  siteKinds,
  themeNode,
  type ElementId,
  type SchemeName,
  type ScopedElement,
  type TraitReads,
} from "@airdesign/document"
import {
  readSlides,
  readTraits,
  shownAlphas,
  shownCrop,
  shownEffects,
  shownBody,
  shownConnection,
  shownFill,
  shownGeometry,
  shownIdentity,
  shownImage,
  shownLine,
  shownTheme,
  shownTurn,
  themeSwatches,
  type DeckTraits,
} from "@airdesign/pptx"
import type { CommitOutcome } from "@/commit-edit"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { formatCopy } from "@/copy/format-copy"
import {
  panelOf,
  type NodeChoice,
  type PanelReads,
  type PanelSection,
  type Swatch as PaletteSwatch,
} from "@/design/panel"
import { changeDesign, fileValue } from "@/design/design-change"
import { deviceScope } from "@/design/trait-edit"
import { designShown, type DesignShown } from "@/design-shown"
import {
  BackgroundKind,
  DesignHead,
  DesignSection,
  ElementDesign,
  SectionRows,
  Swatch,
  SwatchButton,
} from "@/editor/design-panel"
import type { DeckPaint } from "@/editor/use-deck-paint"
import type { UndoList } from "@/editor/use-undo"
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

const shownFields = new WeakMap<Parts, Map<ElementId, PanelReads["fields"]>>()

function fieldsOf(parts: Parts, node: ElementId): PanelReads["fields"] {
  const read = shownFields.get(parts) ?? new Map<ElementId, PanelReads["fields"]>()
  shownFields.set(parts, read)
  if (!read.has(node)) read.set(node, fieldsRead(parts, node))
  return read.get(node)
}

function fieldsRead(parts: Parts, node: ElementId): PanelReads["fields"] {
  const { slide, shape } = shapeOf(node)
  const part = readSlides(parts).find((each) => each.slide === slide)?.part
  if (part === undefined) return {}
  const at = { slide, part, shape }
  try {
    const fill = shownFill(parts, at)
    const geometry = shownGeometry(parts, at)
    const turn = shownTurn(parts, at)
    const line = Object.entries(shownLine(parts, at) ?? {}).map(([field, shown]) => [`line.${field}`, shown])
    const body = Object.entries(shownBody(parts, at) ?? {}).map(([field, shown]) => [`body.${field}`, shown])
    const alphas = Object.entries(shownAlphas(parts, at)).map(([trait, value]) => [
      `${trait}.alpha`,
      { value, own: true },
    ])
    const effects = Object.entries(shownEffects(parts, at) ?? {}).map(([field, shown]) => [`effects.${field}`, shown])
    const image = shownImage(parts, at)
    const crop = shownCrop(parts, at)
    const connection = shownConnection(parts, at)
    const identity = Object.entries(shownIdentity(parts, at) ?? {}).map(([field, value]) => [
      `identity.${field}`,
      { value, own: true },
    ])
    return {
      ...(image === null
        ? {}
        : {
            "image.source": { value: image.source, own: true },
            "image.recolor": { value: image.recolor, own: true },
            "image.alpha": { value: image.alpha, own: true },
          }),
      ...(crop === null ? {} : { "crop.rect": { value: crop, own: true } }),
      ...(connection === null
        ? {}
        : {
            "connection.start": { value: connection.start, own: true },
            "connection.end": { value: connection.end, own: true },
          }),
      ...Object.fromEntries(identity),
      ...(fill === null ? {} : { "fill.value": fill }),
      ...(geometry === null ? {} : { "geometry.shape": geometry }),
      "box.rot": { value: turn.rot, own: true },
      "box.flipH": { value: turn.flipH, own: true },
      "box.flipV": { value: turn.flipV, own: true },
      ...Object.fromEntries(line),
      ...Object.fromEntries(body),
      ...Object.fromEntries(alphas),
      ...Object.fromEntries(effects),
    }
  } catch {
    return {}
  }
}

function paletteOf(parts: Parts, index: number): readonly PaletteSwatch[] {
  const part = readSlides(parts)[index]?.part
  if (part === undefined) return []
  return themeSwatches(parts, part).map((swatch) => ({ ...swatch, name: formatCopy.colors[swatch.scheme] }))
}

function nodeChoices(deck: DesigningDeck, connector: ScopedElement): readonly NodeChoice[] {
  const { shown } = deck
  const scope = deviceScope(shown.shownParts.current, shown.shownRegister.current ?? openRegister("", ""))
  const nodes = shown.store.current.slides()[shown.current]?.elements ?? []
  return nodes.flatMap((node) => {
    const view = node === connector.node ? undefined : scope.view(node)
    if (
      view === undefined ||
      !siteKinds.includes(view.facts.kind) ||
      view.outline === undefined ||
      view.outline === null
    )
      return []
    if ((view.parent ?? null) !== (connector.parent ?? null)) return []
    const name = fieldsOf(shown.displayParts.current, node)?.["identity.name"]?.value
    return [{ node, name: typeof name === "string" && name !== "" ? name : node }]
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
    ...(view.facts.kind === "connector" ? { nodes: nodeChoices(deck, view) } : {}),
  })
  return (
    <ElementDesign
      model={model}
      kind={view.facts.kind}
      palette={palette}
      onChange={(row, value) => changeDesign(deck, row.change(value))}
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
      onColor={(scheme) =>
        changeDesign(deck, { target: { slide: view.slide }, fill: { value: { solid: { scheme } } } })
      }
    >
      <LiveThemeDesign deck={deck} />
    </DesignView>
  )
}

function themeSection(deck: DesigningDeck): PanelSection | null {
  const { shown } = deck
  const parts = shown.displayParts.current
  const part = readSlides(parts)[shown.current]?.part
  const view = deviceScope(shown.shownParts.current, shown.shownRegister.current ?? openRegister("", "")).view(
    themeNode,
  )
  if (part === undefined || view === undefined) return null
  const read = Object.entries(shownTheme(parts, part))
  const fields = Object.fromEntries(read.map(([field, value]) => [`theme.${field}`, { value, own: true }]))
  return panelOf(view, { reads: {}, moves: false, fields }).sections.find(({ trait }) => trait === "theme") ?? null
}

function LiveThemeDesign({ deck }: { deck: DesigningDeck }) {
  const section = themeSection(deck)
  if (section === null) return null
  return (
    <DesignSection title={section.label} last>
      <div className="flex flex-col gap-2" data-design-theme>
        <SectionRows
          rows={section.rows}
          palette={[]}
          onChange={(row, value) => changeDesign(deck, row.change(value))}
        />
      </div>
    </DesignSection>
  )
}

export function DesignView({
  shown,
  onColor,
  children = null,
}: {
  shown: DesignShown
  onColor: (scheme: SchemeName) => void
  children?: ReactNode
}) {
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
      <DesignSection title={designCopy.colors} id={heading} last={children === null}>
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
      {children}
    </div>
  )
}
