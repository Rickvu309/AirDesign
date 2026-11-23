import { doom } from "@airdesign/document"
import { slideId, type FieldValue } from "@airdesign/document"
import { useDoomSlide } from "@airdesign/render"
import { useMemo } from "react"
import { designCopy } from "@/copy/design-copy"
import { doomEditorCopy } from "@/copy/doom-editor-copy"
import { panelOfMany, type PanelModel } from "@/design/panel"
import { panelPlaces } from "@/design/panel-order"
import { DesignHead, ElementDesign } from "@/editor/design-panel"
import { ElementTitleActions } from "@/editor/element-title-actions"
import { SlideBackground } from "@/editor/live-design-panel"
import { PicturePreview } from "@/editor/picture-preview"
import { pickPicture } from "@/editor/picture-picker"
import { RemoveAutoLayoutButton } from "@/editor/remove-auto-layout"
import { ChartSection } from "./design-chart"
import { changeWrites, type ChangeContext } from "./design-changes"
import { storePicture, useAssetUrl } from "./design-media"
import { nodeModel } from "./design-model"
import { paintDesc } from "./design-model-fills"
import { paletteOf } from "./design-palette"
import { fillWrite, shownFill } from "./design-paint-values"
import { DoomSelectionColors } from "./design-selection-section"
import { DoomThemeCard } from "./design-theme-card"
import { doomColorOf, type OldPaint } from "./design-values"
import { propOf, slidesOf } from "./node-props"
import { resolveColorOf } from "./design-slide-color"
import type { Selection } from "./selection"
import { geometryOf } from "./slide-geometry"
import type { EditorClient } from "./use-doom-deck"

const panelMode = "slides"

const layoutOffWrites = (node: doom.NodeId): readonly doom.Write[] => [
  { node, prop: "layout", value: { mode: "none" } },
]

type Props = {
  readonly deck: string
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly slideNumber: number
  readonly selection: Selection
  readonly onSelection: (selection: Selection) => void
}

function backgroundFill(held: OldPaint): FieldValue<"fills", "p0"> | null {
  if ("gradient" in held) return held as FieldValue<"fills", "p0">
  return "image" in held ? { image: true } : null
}

function isImagePick(value: unknown): boolean {
  return typeof value === "object" && value !== null && "image" in value && value.image === true
}

export function DesignPanel(props: Props) {
  const { deck, client, view, slide, selection, onSelection } = props
  const ids = selection.ids.filter((id) => view.nodes.has(id))
  const painted = useDoomSlide(view, slide)
  const geometry = useMemo(() => geometryOf(painted.nodes ?? []), [painted.nodes])
  const theme = doom.deckOf(view).theme
  const palette = useMemo(() => paletteOf(view, theme), [view, theme])
  const slides = slidesOf(view)
  const context: ChangeContext = { view, ids, geometry, size: doom.deckOf(view).size, slides }
  const push = (writes: readonly doom.Write[]) => {
    if (writes.length > 0) client.push(writes)
  }
  const replaceImage = (targets: readonly doom.NodeId[], file: Blob) => {
    void storePicture(deck, file).then((asset) => {
      if (asset === null) return
      const latest = client.view()
      push(
        targets.flatMap((node): doom.Write[] => {
          const next = fillWrite(propOf(latest.nodes.get(node), "fills"), { image: asset })
          return next === undefined ? [] : [{ node, prop: "fills", value: next }]
        }),
      )
    })
  }
  const [only] = ids
  const pictured =
    only === undefined ? undefined : propOf(view.nodes.get(only), "fills")?.findLast((paint) => paint.kind === "image")
  const url = useAssetUrl(deck, pictured?.kind === "image" ? pictured.asset : undefined)
  if (ids.length === 0) {
    const background = propOf(view.nodes.get(slide), "fills")
    const solid = shownFill(background)
    const held = "solid" in solid ? doomColorOf(solid.solid) : undefined
    const shownColor = held ?? { var: "background" as const }
    return (
      <div
        data-design-panel=""
        aria-label={doomEditorCopy.designPanel}
        role="region"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <DesignHead>{designCopy.slide(props.slideNumber)}</DesignHead>
        {panelPlaces("slide", panelMode).map(({ section }) => {
          if (section === "templateStyle")
            return <DoomThemeCard key={section} client={client} view={view} theme={theme} />
          if (section === "background")
            return (
              <SlideBackground
                key={section}
                paint={paintDesc()}
                shown={{
                  slide: slideId(slide),
                  background: resolveColorOf(shownColor, theme, palette),
                  fill: backgroundFill(solid),
                  templateColors: palette.templateColors,
                }}
                deck={palette.deck}
                onFill={(paint) => {
                  if (isImagePick(paint)) return pickPicture((file) => replaceImage([slide], file))
                  const next = fillWrite(background, paint)
                  if (next !== undefined) push([{ node: slide, prop: "fills", value: next }])
                }}
              />
            )
          if (section === "selectionColors")
            return (
              <DoomSelectionColors
                key={section}
                client={client}
                view={view}
                slide={slide}
                ids={[]}
                palette={palette}
                onSelection={onSelection}
              />
            )
          return null
        })}
      </div>
    )
  }
  const models = ids.map((id) => nodeModel({ view, id, theme, slides }))
  const [first, ...rest] = models
  if (first === undefined) return null
  const model: PanelModel = rest.length === 0 ? first : panelOfMany([first, ...rest], panelMode)
  const autoLayout = ids.length === 1 && model.frame === "auto"
  const chart = ids.length === 1 && only !== undefined && propOf(view.nodes.get(only), "chart") !== undefined
  return (
    <ElementDesign
      model={model}
      mode={panelMode}
      palette={palette}
      picture={url === null ? null : <PicturePreview src={url} />}
      titleActions={
        <ElementTitleActions onMatch={undefined} model={model} onReplace={(_node, file) => replaceImage(ids, file)} />
      }
      afterTitle={
        autoLayout && only !== undefined ? (
          <RemoveAutoLayoutButton onRemove={() => push(layoutOffWrites(only))} />
        ) : null
      }
      selectionColors={
        <DoomSelectionColors
          client={client}
          view={view}
          slide={slide}
          ids={ids}
          palette={palette}
          onSelection={onSelection}
        />
      }
      onChange={(control, value) => {
        if (control.trait === "fills" && control.field === "paint" && isImagePick(value))
          return pickPicture((file) => replaceImage(ids, file))
        push(changeWrites(context, control, value))
      }}
    >
      {chart && only !== undefined ? <ChartSection id={only} view={view} push={push} /> : null}
    </ElementDesign>
  )
}
