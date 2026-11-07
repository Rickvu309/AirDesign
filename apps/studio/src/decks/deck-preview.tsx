import {Slide} from "../../../../packages/render/src/index.ts"
import type {DeckEntry} from "../../../../packages/catalog/src/index.ts"

export function DeckPreview({entry}:{entry:DeckEntry}) {
  const preview=entry.preview
  return <div className="deck-preview" aria-hidden="true">{preview ? <div className="deck-preview-canvas" style={{inlineSize:preview.slide.size.width,blockSize:preview.slide.size.height,transform:`translate(-50%, -50%) scale(min(calc(100cqi / ${preview.slide.size.width}px), calc(100cqb / ${preview.slide.size.height}px)))`}}><Slide slide={preview.slide} themes={preview.themes}/></div> : <span className="deck-preview-blank"/>}</div>
}
