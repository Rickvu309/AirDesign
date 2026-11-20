import type { TextParagraph, TextValue } from "@airdesign/document"
import type { Held } from "./fills-held"

const paragraphKeys = ["align", "list", "lineHeight", "spaceBefore", "spaceAfter"] as const

function agreed(values: readonly unknown[], fallback: Held): Held {
  const [first, ...rest] = values.map((value) => value ?? fallback.value)
  const mixed = rest.some((each) => JSON.stringify(each) !== JSON.stringify(first))
  const inherited = fallback.inherited && values.every((value) => value === undefined)
  return { value: mixed ? undefined : first, mixed, inherited: inherited && !mixed }
}

function paragraphShown(paragraph: TextParagraph, key: string): unknown {
  if (key === "lineHeight" && paragraph.lineHeightPoints !== undefined) return { points: paragraph.lineHeightPoints }
  return (paragraph as Readonly<Record<string, unknown>>)[key]
}

export function textShown(text: TextValue, key: string, fallback: Held): Held {
  if ((paragraphKeys as readonly string[]).includes(key)) {
    return agreed(
      text.map((paragraph) => paragraphShown(paragraph, key)),
      fallback,
    )
  }
  const runs = text.flatMap((paragraph) => paragraph.runs).filter((run) => run.text !== "")
  if (runs.length === 0) return fallback
  return agreed(
    runs.map((run) =>
      key === "fill"
        ? (run.fill ?? (run.color === undefined ? undefined : { solid: run.color }))
        : (run as Readonly<Record<string, unknown>>)[key],
    ),
    fallback,
  )
}
