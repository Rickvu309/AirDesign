import { fieldsOf } from "@/lib/fields-of"
import {
  airaPictureBytes,
  airaPictureCap,
  pictureNotFitted,
  type ResultBlock,
  type ToolAnswer,
} from "@airdesign/catalog"

export function cappedPictures(answers: readonly ToolAnswer[]): readonly ToolAnswer[] {
  let shown = 0
  let bytes = 0
  const fitted = (block: ResultBlock): ResultBlock => {
    if (block.type !== "image") return block
    const size = block.source.data.length
    if (shown >= airaPictureCap || bytes + size > airaPictureBytes) return { type: "text", text: pictureNotFitted }
    shown += 1
    bytes += size
    return block
  }
  return answers.map((answer) =>
    typeof answer.content === "string" ? answer : { ...answer, content: answer.content.map(fitted) },
  )
}

export function toolAnswer(id: string, text: string, ok: boolean, pictures?: readonly ResultBlock[]): ToolAnswer {
  const content = pictures ?? text
  return ok
    ? { type: "tool_result", tool_use_id: id, content }
    : { type: "tool_result", tool_use_id: id, content, is_error: true }
}

export type FontIssue = {
  readonly kind: "coverage" | "shaping" | "pending"
  readonly characters: string
  readonly layers: readonly string[]
  readonly layerNames: readonly string[]
  readonly shaping?: readonly string[]
  readonly target?: string
}

export function stringList(raw: unknown): readonly string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []
}

export function readFontIssue(raw: unknown): FontIssue | undefined {
  const fields = fieldsOf(raw)
  if (fields === undefined) return undefined
  const layers = stringList(fields.layers)
  if (layers.length === 0) return undefined
  const reason = fields.reason ?? fields.kind
  const shaping = stringList(fields.shaping)
  return {
    kind: reason === "shaping" || reason === "pending" ? reason : "coverage",
    characters: typeof fields.characters === "string" ? fields.characters : "",
    layers,
    layerNames: stringList(fields.layerNames),
    ...(shaping.length === 0 ? {} : { shaping }),
    ...(typeof fields.target === "string" ? { target: fields.target } : {}),
  }
}
