import type { ParagraphAlign, RunColor, TextFormat } from "@airdesign/document"
import type { CanvasBullet } from "./text-record.js"
import type { RunPaint, TextLook } from "./text-look.js"

type ShownAlign = ParagraphAlign | "justify"

type ShownRun = {
  readonly from: number
  readonly text: string
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly size?: number
  readonly color?: RunColor | string | null
}

type ShownParagraph = {
  readonly from: number
  readonly align?: ShownAlign
  readonly bullet?: boolean | CanvasBullet | null
  readonly runs: readonly ShownRun[]
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
  return paint
}

export function SheetText(props: {
  readonly text: { readonly paragraphs: readonly ShownParagraph[] }
  readonly look: TextLook
}) {
  const { look, text } = props
  return (
    <div style={look.body}>
      {text.paragraphs.map((paragraph, index) => {
        const filled = paragraph.runs.some((run) => run.text !== "")
        const align = placed(paragraph.align)
        const bullet = paragraph.bullet === true || paragraph.bullet === false ? paragraph.bullet : undefined
        const style = look.paragraph(paragraph.from, filled, {
          ...(align === undefined ? {} : { align }),
          ...(bullet === undefined ? {} : { bullet }),
        })
        const shown = filled || paragraph.bullet === true ? style : { ...style, "--bullet": "none" }
        return (
          <div key={index} data-paragraph={paragraph.from} style={shown}>
            {paragraph.runs.map((run, at) => (
              <span key={at} style={look.run(paragraph.from, run.from, overlayOf(run))}>
                {run.text}
              </span>
            ))}
            {filled ? null : <br />}
          </div>
        )
      })}
    </div>
  )
}
