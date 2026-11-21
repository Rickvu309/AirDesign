import type { ElementId } from "@airdesign/document"
import type { FindingsReport, WireFinding } from "./findings-wire.js"

type Change =
  | { readonly op: "set"; readonly target: ElementId; readonly [field: string]: unknown }
  | { readonly op: "delete"; readonly node: ElementId }

export type AgentFinding = {
  readonly code: WireFinding["code"]
  readonly node: ElementId
  readonly measure: string
  readonly fix?: Change
}

const tenths = (value: number) => Math.round(value * 10) / 10
const above = (value: number) => Math.ceil(value * 10) / 10

function set(target: ElementId, fields: Readonly<Record<string, unknown>>): Change {
  return { op: "set", target, ...fields }
}

function told(finding: WireFinding): Omit<AgentFinding, "code" | "node"> {
  const { node } = finding
  switch (finding.code) {
    case "overflow":
      return {
        measure: `text ${tenths(finding.needed)} pt, room ${tenths(finding.room)}`,
        fix:
          finding.size === null
            ? set(node, { box: { h: above(finding.height) } })
            : set(node, { text: { size: finding.size } }),
      }
    case "off-slide":
      return {
        measure: finding.whole ? "outside the slide" : `${tenths(finding.past)} pt past the edge`,
        ...(finding.x === null || finding.y === null
          ? {}
          : { fix: set(node, { box: { x: tenths(finding.x), y: tenths(finding.y) } }) }),
      }
    case "overlap":
      return {
        measure: `${finding.by === "cover" ? "under" : "crosses"} ${finding.other}`,
        fix: set(finding.other, { box: { x: tenths(finding.x), y: tenths(finding.y) } }),
      }
    case "small-text":
      return {
        measure: `${tenths(finding.size)} pt, under ${finding.min}`,
        ...(finding.uniform ? { fix: set(node, { text: { size: finding.min } }) } : {}),
      }
    case "low-contrast":
      return {
        measure: `${tenths(finding.ratio)}:1, needs ${finding.needs}:1`,
        ...(finding.color === null ? {} : { fix: set(node, { text: { color: `#${finding.color}` } }) }),
      }
    case "empty-placeholder":
      return { measure: `empty ${finding.placeholder}`, fix: { op: "delete", node } }
  }
}

export function agentFindings(
  findings: readonly WireFinding[],
  shown: (node: ElementId) => boolean,
): readonly AgentFinding[] {
  return findings
    .filter(({ node }) => shown(node))
    .map((finding) => ({ code: finding.code, node: finding.node, ...told(finding) }))
}

export type AgentFindings = readonly AgentFinding[] | "missing" | `pending ${number}` | `broken ${number}`

export function findingsAt(
  report: FindingsReport | undefined,
  revision: number,
  shown: (node: ElementId) => boolean,
): AgentFindings {
  if (report === undefined) return "missing"
  if (report.revision !== revision) return `pending ${revision}`
  return report.broken === true ? `broken ${revision}` : agentFindings(report.findings, shown)
}
