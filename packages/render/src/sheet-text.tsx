import type { TextRun } from "@airdesign/document"
import type { TextLook } from "./text-look.js"

type ShownParagraph = { readonly from: number; readonly runs: readonly TextRun[] }

export function SheetText(props: {
  readonly text: { readonly paragraphs: readonly ShownParagraph[] }
  readonly look: TextLook
}) {
  const { look, text } = props
  return (
    <div style={look.body}>
      {text.paragraphs.map((paragraph, index) => {
        const filled = paragraph.runs.some((run) => run.text !== "")
        return (
          <div
            key={index}
            data-paragraph={paragraph.from}
            style={
              filled
                ? look.paragraph(paragraph.from, true)
                : { ...look.paragraph(paragraph.from, false), "--bullet": "none" }
            }
          >
            {paragraph.runs.map((run, at) => (
              <span key={at} style={look.run(paragraph.from, run.from, run)}>
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
