import type { ElementLink, ParagraphAlign, ParagraphSpacing, Color, TextFormat } from "@airdesign/document"
import type { CanvasBullet } from "./text-record.js"
import { endsInBreak, type RunPaint, type TextLook } from "./text-look.js"

type ShownAlign = ParagraphAlign | "justify"

type ShownRun = {
  readonly link?: ElementLink
  readonly from: number
  readonly text: string
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly size?: number
  readonly color?: Color | string | null
  readonly font?: string | null
}

type ShownParagraph = {
  readonly from: number
  readonly align?: ShownAlign
  readonly bullet?: boolean | CanvasBullet | null
  readonly runs: readonly ShownRun[]
  readonly lineSpacing?: unknown
  readonly spaceBefore?: unknown
  readonly spaceAfter?: unknown
}

function placed(align: ShownAlign | undefined): ParagraphAlign | undefined {
  return align === "left" || align === "center" || align === "right" ? align : undefined
}

function overlayOf(run: ShownRun): RunPaint {
  if (typeof run.color === "string" || run.color === null) return {}
  const color = run.color
  const flags: TextFormat[] = ["bold", "italic", "underline"]
  let paint: RunPaint = {}
  for (const name of flags) {
    const set = run[name]
    if (set !== undefined) paint = { ...paint, [name]: set }
  }
  if (run.size !== undefined) paint = { ...paint, size: run.size }
  if (color !== undefined) paint = { ...paint, color }
  if (
    run.link !== undefined &&
    run.link.kind !== "none" &&
    run.link.kind !== "unsupported" &&
    run.underline === undefined
  )
    paint = { ...paint, underline: true }
  if (typeof run.font === "string") paint = { ...paint, font: run.font }
  return paint
}

function spacingOf(paragraph: ShownParagraph): ParagraphSpacing {
  const kept = (value: unknown) => (typeof value === "number" ? value : undefined)
  const line = kept(paragraph.lineSpacing)
  const before = kept(paragraph.spaceBefore)
  const after = kept(paragraph.spaceAfter)
  return {
    ...(line === undefined ? {} : { lineSpacing: line }),
    ...(before === undefined ? {} : { spaceBefore: before }),
    ...(after === undefined ? {} : { spaceAfter: after }),
  }
}

export function SheetText(props: {
  readonly text: { readonly paragraphs: readonly ShownParagraph[] }
  readonly look: TextLook
}) {
  const { look, text } = props
  return (
    <div data-text-body="" style={look.body}>
      {text.paragraphs.map((paragraph, index) => {
        const filled = paragraph.runs.some((run) => run.text !== "")
        const align = placed(paragraph.align)
        const bullet = paragraph.bullet === true || paragraph.bullet === false ? paragraph.bullet : undefined
        const overlay = {
          ...(align === undefined ? {} : { align }),
          ...(bullet === undefined ? {} : { bullet }),
          ...spacingOf(paragraph),
        }
        const style = look.paragraph(paragraph.from, filled, overlay)
        const shown = filled || paragraph.bullet === true ? style : { ...style, "--bullet": "none" }
        return (
          <div
            key={index}
            data-paragraph={paragraph.from}
            data-end-break={endsInBreak(paragraph.runs.map((run) => run.text).join("")) ? "" : undefined}
            style={shown}
          >
            {paragraph.runs.map((run, at) =>
              run.link !== undefined && run.link.kind !== "none" && run.link.kind !== "unsupported" ? (
                <a
                  key={at}
                  data-text-link
                  onClick={(event) => {
                    if (event.currentTarget.closest("[data-link-navigation]") === null) event.preventDefault()
                  }}
                  href={run.link.kind === "url" ? run.link.url : `#slide-${run.link.slide}`}
                  target={run.link.kind === "url" ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  style={{
                    ...look.run(paragraph.from, run.from, overlayOf(run), overlay),
                    pointerEvents: "auto",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {run.text}
                </a>
              ) : (
                <span key={at} style={look.run(paragraph.from, run.from, overlayOf(run), overlay)}>
                  {run.text}
                </span>
              ),
            )}
            {filled ? null : <br />}
          </div>
        )
      })}
    </div>
  )
}
