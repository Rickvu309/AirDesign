import type { TextLook } from "./text-look.js"

type ShownParagraph = {
  readonly from: number
  readonly runs: readonly { readonly from: number; readonly text: string }[]
}

export function SheetText(props: {
  readonly text: { readonly paragraphs: readonly ShownParagraph[] }
  readonly look: TextLook
}) {
  const { look, text } = props
  return (
    <div style={look.body}>
      {text.paragraphs.map((paragraph) => {
        const filled = paragraph.runs.some((run) => run.text !== "")
        return (
          <div key={paragraph.from} data-paragraph={paragraph.from} style={look.paragraph(paragraph.from, filled)}>
            {paragraph.runs.map((run) => (
              <span key={run.from} style={look.run(paragraph.from, run.from)}>
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
