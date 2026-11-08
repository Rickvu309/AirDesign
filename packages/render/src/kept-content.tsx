import type { Element } from "../../deck/src/model.ts"
import { contentLabel } from "../../deck/src/content-labels.ts"

export function preservationLabel(element: Element): string {
  const label = contentLabel(element)
  if(element.support.kind === "flagged" && element.support.preservation === "removed")return `${label} · Removed for safety · ${element.support.reason}`
  return element.support.kind === "flagged" ? `${label} · Preserved on export · Review: ${element.support.reason}` : `${label} · Preserved on export · Preview may be unavailable`
}
export function KeptContent({ element }: { element: Element }) {
  if (element.support.kind === "native") return null
  return <div data-kept-content="" role="img" aria-label={preservationLabel(element)} style={{ inlineSize: "100%", blockSize: "100%", background: "var(--muted, #f5f5f5)", color: "var(--foreground, #171717)", border: "1px solid var(--border, #a3a3a3)", overflow: "clip", fontFamily: "Geist, sans-serif", fontSize: 12 }}>
    {element.support.preview?.trim() && <img src={element.support.preview} alt="Stored preview" style={{ maxInlineSize: "100%", maxBlockSize: "60%", objectFit: "contain" }} />}
    <span>{preservationLabel(element)}</span>
  </div>
}
