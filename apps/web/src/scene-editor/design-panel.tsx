import { scene } from "@airdesign/document"
import { useSceneSlide } from "@airdesign/render"
import { useMemo, type ComponentType } from "react"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import { DesignHead } from "@/editor/design-panel"
import { AppearanceSection, BoxSection, LayoutSection, SizingSection } from "./design-box"
import { EffectsSection, FillsSection, StrokesSection } from "./design-paint"
import type { PanelContext } from "./design-parts"
import { ChartSection, TextSection } from "./design-text"
import { ThemeSection } from "./design-theme"
import { PanelSection } from "./panel-fields"
import { PaintList } from "./paint-list"
import { sectionsFor, type Section } from "./panel-model"
import { setEach } from "./panel-writes"
import type { Selection } from "./selection"
import { geometryOf } from "./slide-geometry"
import type { EditorClient } from "./use-scene-deck"

const sections: Readonly<Record<Section, ComponentType<PanelContext>>> = {
  box: BoxSection,
  sizing: SizingSection,
  layout: LayoutSection,
  appearance: AppearanceSection,
  text: TextSection,
  fills: FillsSection,
  strokes: StrokesSection,
  effects: EffectsSection,
  chart: ChartSection,
}

export function DesignPanel(props: {
  readonly client: EditorClient
  readonly view: scene.Scene
  readonly slide: scene.NodeId
  readonly selection: Selection
}) {
  const { client, view, slide } = props
  const ids = props.selection.ids.filter((id) => view.nodes.has(id))
  const painted = useSceneSlide(view, slide)
  const geometry = useMemo(() => geometryOf(painted.nodes ?? []), [painted.nodes])
  const theme = scene.deckOf(view).theme
  const context: PanelContext = {
    ids,
    view,
    geometry,
    theme,
    push: (writes) => {
      if (writes.length > 0) client.push(writes)
    },
  }
  const slideName = (view.nodes.get(slide) as { name?: string } | undefined)?.name ?? ""
  const background = (view.nodes.get(slide) as { fills?: readonly scene.Paint[] } | undefined)?.fills ?? []
  return (
    <div
      data-design-panel=""
      aria-label={sceneEditorCopy.designPanel}
      role="region"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      <DesignHead>
        {ids.length === 0
          ? slideName === ""
            ? sceneEditorCopy.nothingSelected
            : slideName
          : sceneEditorCopy.designPanel}
      </DesignHead>
      {ids.length === 0 ? (
        <>
          <PanelSection title={sceneEditorCopy.background} name="slide-fill">
            <PaintList
              label={sceneEditorCopy.fills}
              paints={background}
              mixed={false}
              theme={theme}
              onChange={(paints) => context.push(setEach([slide], "fills", paints.length === 0 ? null : paints))}
            />
          </PanelSection>
          <ThemeSection {...context} />
        </>
      ) : (
        sectionsFor(view, ids).map((name) => {
          const Section = sections[name]
          return <Section key={name} {...context} />
        })
      )}
    </div>
  )
}
