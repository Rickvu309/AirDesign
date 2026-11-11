import { expect } from "vitest"
export function landedAnswer(
  revision: number,
  elements: readonly { node: string; value: string; version: number }[],
  runId: unknown = expect.any(String),
) {
  return { ok: true, revision, runId, elements }
}

export function landedContent(
  revision: number,
  elements: readonly { node: string; value: string; version: number }[],
  runId: string,
) {
  return [
    { type: "text", text: `Landed revision ${String(revision)}.` },
    { type: "text", text: JSON.stringify(landedAnswer(revision, elements, runId)) },
  ]
}
