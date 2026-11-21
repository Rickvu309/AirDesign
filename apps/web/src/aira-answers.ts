import { airaPictureCap, withoutPictures, type ResultBlock, type ToolAnswer } from "@airdesign/catalog"

export function cappedPictures(answers: readonly ToolAnswer[]): readonly ToolAnswer[] {
  let shown = 0
  return answers.map((answer) => {
    const pictures = typeof answer.content === "string" ? 0 : answer.content.filter((b) => b.type === "image").length
    shown += pictures
    return shown > airaPictureCap ? withoutPictures(answer) : answer
  })
}

export function toolAnswer(id: string, text: string, ok: boolean, pictures?: readonly ResultBlock[]): ToolAnswer {
  const content = pictures ?? text
  return ok
    ? { type: "tool_result", tool_use_id: id, content }
    : { type: "tool_result", tool_use_id: id, content, is_error: true }
}
