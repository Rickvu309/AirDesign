import type { Answer } from "./answer.js"

export function encode(answer: Answer) {
  const content = [
    ...answer.pictures.map((data) => ({ type: "image" as const, data, mimeType: "image/jpeg" as const })),
    { type: "text" as const, text: JSON.stringify(answer.fields) },
  ]
  return answer.ok
    ? { content, structuredContent: answer.fields }
    : { content, isError: true as const, structuredContent: answer.fields }
}
