import * as doom from "@airdesign/doom"
import { useDoomSlide } from "@airdesign/render"
import { useMemo } from "react"
import { designCopy } from "@/copy/design-copy"
import { editorCopy } from "@/copy/editor-copy"
import { panelOfMany, type PanelModel, type PanelPaint } from "@/design/panel"
import { panelSections } from "@/design/panel-order"
import { useServedFaces } from "@/design/served-faces"
import { DesignHead, ElementDesign } from "@/editor/design-sections"
import { ElementTitleActions } from "@/editor/element-title-actions"
import { SlideBackground } from "@/editor/slide-background"
import { PicturePreview } from "@/editor/picture-preview"
import { pickPicture } from "@/editor/picture-picker"
import { RemoveAutoLayoutButton } from "@/editor/remove-auto-layout"
import { ChartSection } from "./design-chart"
import { changeWrites, linkOf, type ChangeContext } from "./design-changes"
import { storePicture, useAssetUrl } from "./design-media"
import { nodeModel } from "./design-model"
import { paintDesc } from "./design-model-fills"
import { paletteOf } from "./design-palette"
import { fillWrite, shownFill } from "./design-paint-values"
import { DoomSelectionColors } from "./design-selection-section"
import { panelTitle } from "./panel-title"
import { DoomThemeCard } from "./design-theme-card"
import { resolveColorOf } from "./design-slide-color"
import type { Selection } from "./selection"
import { HiddenLockedLayers } from "./hidden-locked"
import { geometryOf } from "./slide-geometry"
import type { EditorClient } from "./use-deck"
import type { CaretWords } from "./canvas"

const estimate = doom.measureWith({})

type Props = {
  readonly deck: string
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly slideNumber: number
  readonly selection: Selection
  readonly onSelection: (selection: Selection) => void
  readonly words: CaretWords | null
  readonly onCrop: (id: doom.NodeId) => void
  readonly onLinkWords: (link: string | null) => void
}

function backgroundFill(held: PanelPaint): PanelPaint | null {
  if ("gradient" in held) return held
  return "image" in held ? { image: true } : null
}

function isImagePick(value: unknown): boolean {
  return typeof value === "object" && value !== null && "image" in value && value.image === true
}

export function DesignPanel(props: Props) {
  useServedFaces()
  const { deck, client, view, slide, selection, onSelection } = props
  const ids = selection.ids.filter((id) => view.nodes.has(id))
  const painted = useDoomSlide(view, slide)
  const geometry = useMemo(() => geometryOf(painted.nodes ?? []), [painted.nodes])
  const theme = doom.deckOf(view).theme
  const palette = useMemo(() => paletteOf(view, theme), [view, theme])
  const slides = doom.slidesOf(view).map((each) => each.id)
  const context: ChangeContext = { view, ids, geometry, size: doom.deckOf(view).size, slides }
  const replaceImage = (targets: readonly doom.NodeId[], file: Blob) => {
    void storePicture(deck, file).then((asset) => {
      if (asset === null) return
      const latest = client.view()
      client.push(
        targets.flatMap((node): doom.Write[] => {
          const next = fillWrite(doom.propOf(latest.nodes.get(node), "fills"), { image: asset })
          return next === undefined ? [] : [{ node, prop: "fills", value: next }]
        }),
      )
    })
  }
  const [only] = ids
  const pictured =
    only === undefined
      ? undefined
      : doom.propOf(view.nodes.get(only), "fills")?.findLast((paint) => paint.kind === "image")
  const url = useAssetUrl(deck, pictured?.kind === "image" ? pictured.asset : undefined)
  if (ids.length === 0) {
    const background = doom.propOf(view.nodes.get(slide), "fills")
    const solid = shownFill(background)
    const held = "solid" in solid ? solid.solid : undefined
    const shownColor = held ?? { var: "background" as const }
    return (
      <div
        data-design-panel=""
        aria-label={editorCopy.designPanel}
        role="region"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <DesignHead>{designCopy.slide(props.slideNumber)}</DesignHead>
        <HiddenLockedLayers view={view} slide={slide} push={client.push} />
        {panelSections("slide").map((section) => {
          if (section === "templateStyle")
            return <DoomThemeCard key={section} client={client} view={view} theme={theme} />
          if (section === "background")
            return (
              <SlideBackground
                key={section}
                paint={paintDesc}
                shown={{
                  background: resolveColorOf(shownColor, theme, palette),
                  fill: backgroundFill(solid),
                  templateColors: palette.templateColors,
                }}
                deck={palette.deck}
                onFill={(paint) => {
                  if (isImagePick(paint)) return pickPicture((file) => replaceImage([slide], file))
                  const next = fillWrite(background, paint)
                  if (next !== undefined) client.push([{ node: slide, prop: "fills", value: next }])
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
  const words = ids.length === 1 && props.words?.node === only ? props.words : null
  const models = ids.map((id) => nodeModel({ view, id, theme, slides, words }))
  const [first, ...rest] = models
  if (first === undefined) return null
  const model: PanelModel = rest.length === 0 ? first : panelOfMany([first, ...rest])
  const autoLayout = ids.length === 1 && model.frame === "auto"
  const chart = ids.length === 1 && only !== undefined && doom.propOf(view.nodes.get(only), "chart") !== undefined
  const storedName = only === undefined ? undefined : doom.propOf(view.nodes.get(only), "name")
  const layerName =
    ids.length === 1
      ? typeof storedName === "string" && storedName !== ""
        ? storedName
        : panelTitle(model)
      : undefined
  return (
    <ElementDesign
      model={model}
      palette={palette}
      layerName={layerName}
      onLayerName={
        only === undefined || ids.length !== 1
          ? undefined
          : (name) => client.push([{ node: only, prop: "name", value: name }])
      }
      picture={url === null ? null : <PicturePreview src={url} />}
      titleActions={
        <ElementTitleActions onMatch={undefined} model={model} onReplace={(_node, file) => replaceImage(ids, file)} />
      }
      afterTitle={
        autoLayout && only !== undefined ? (
          <RemoveAutoLayoutButton
            onRemove={() => client.push(doom.bakeLayout(view, only, painted.measure ?? estimate))}
          />
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
        const link = control.trait === "link" && words !== null ? linkOf(value) : undefined
        if (link !== undefined) return props.onLinkWords(link)
        client.push(changeWrites(context, control, value))
        if (
          control.trait === "image" &&
          control.field === "mode" &&
          value === "crop" &&
          only !== undefined &&
          ids.length === 1
        )
          props.onCrop(only)
      }}
    >
      {chart && only !== undefined ? <ChartSection id={only} view={view} push={client.push} /> : null}
    </ElementDesign>
  )
}
