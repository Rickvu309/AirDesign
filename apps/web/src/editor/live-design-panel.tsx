import { useId, useMemo } from "react"
import type { RunColor, SchemeName, SlideId } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { commitBackground } from "@/background-edit"
import type { CommitOutcome } from "@/commit-edit"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { designShown, type DesignShown } from "@/design-shown"
import { BackgroundKind, DesignHead, DesignSection, Swatch, SwatchButton } from "@/editor/design-panel"
import type { DeckPaint } from "@/editor/use-deck-paint"
import type { UndoEntry } from "@/undo-list"

export type DesigningDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly record: (entry: UndoEntry) => void
  readonly settle: (outcome: CommitOutcome) => void
}

const lightest = 0xe0

function light(css: string): boolean {
  const hex = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(css)
  return hex !== null && hex.slice(1).every((pair) => Number.parseInt(pair, 16) >= lightest)
}

export function deckDesign(deck: DesigningDeck) {
  const { id, shown, record, settle } = deck

  async function setBackground(slide: SlideId, color: RunColor) {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return
    const outcome = await commitBackground(
      id,
      shown.shownParts.current,
      opened.register,
      slide,
      color,
      async (undoable) => {
        record({ name: "background", undoable })
        await shown.showEdited(shown.current)
      },
    )
    settle(outcome)
  }

  return { setBackground }
}

export function LiveDesignPanel({ deck }: { deck: DesigningDeck }) {
  const { shown } = deck
  const parts = shown.editParts.current
  const painted = shown.canvases.current(shown.current)?.background ?? null
  const view = useMemo(() => designShown(parts, shown.current, painted), [parts, shown.current, painted])
  if (view === null) return null
  return <DesignView shown={view} onColor={(scheme) => void deckDesign(deck).setBackground(view.slide, { scheme })} />
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
