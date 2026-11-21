import { findingsAt, type FindingsReport } from "@airdesign/catalog"
import type { ToolResult } from "./call-tool.js"

const slideOf = (node: string) => node.split(".")[0] ?? node

export function editFindings(result: ToolResult, report: FindingsReport | undefined): ToolResult {
  const { answer } = result
  if (!result.ok || answer === undefined || !answer.ok) return result
  if (answer.elements.length === 0 && answer.slides === undefined) return result
  const touched = new Set([...answer.elements.map(({ node }) => slideOf(node)), ...(answer.slides ?? [])])
  const told = { ...answer, findings: findingsAt(report, answer.revision, (node) => touched.has(slideOf(node))) }
  return {
    ...result,
    answer: told,
    content: [...result.content.slice(0, -1), { type: "text", text: JSON.stringify(told) }],
  }
}
