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
