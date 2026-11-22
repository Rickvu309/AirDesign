import { expect, it } from "vitest"
import { agentFindings, findingsAt } from "./agent-findings.js"
import { readFindingsReport, type FindingsReport, type WireFinding } from "./index.js"

const green = "1A7A33"

function wire(findings: readonly unknown[]): readonly WireFinding[] {
  const read = readFindingsReport({ deck: "deck", revision: 1, findings })
  if (!read.ok) throw new Error(read.refusal)
  return read.findings
}

it("names each finding with a short measure and a change to send that fixes it", () => {
  const found = wire([
    { code: "overflow", node: "258.7", needed: 86.44, room: 64.8, size: 28, height: 93.6 },
    { code: "overflow", node: "258.8", needed: 86.4, room: 64.8, size: null, height: 93.63 },
    { code: "off-slide", node: "258.9", past: 12.46, whole: false, x: 40, y: 30.04 },
    { code: "off-slide", node: "258.10", past: 0, whole: true, x: null, y: null },
    { code: "overlap", node: "258.11", other: "258.12", by: "cover", x: 72, y: 300.5 },
    { code: "overlap", node: "258.11", other: "258.13", by: "text", x: 72, y: 340 },
    { code: "small-text", node: "258.14", size: 8, min: 10, uniform: true },
    { code: "small-text", node: "258.15", size: 7.5, min: 10, uniform: false },
    { code: "low-contrast", node: "258.16", ratio: 2.87, needs: 4.5, color: "1A7A33" },
    { code: "low-contrast", node: "258.17", ratio: 1, needs: 3, color: null },
    { code: "empty-placeholder", node: "258.18", placeholder: "subTitle" },
    { code: "misaligned", node: "258.19", other: "258.20", edge: "top", by: 1.96, x: null, y: 100 },
    { code: "off-scale", node: "258.21", size: 24, to: 20, style: "Heading", uniform: true },
    { code: "off-scale", node: "258.22", size: 13, to: 11, style: "Caption", uniform: false },
  ])
  expect(agentFindings(found, () => true)).toEqual([
    {
      code: "overflow",
      node: "258.7",
      measure: "text 86.4 pt, room 64.8",
      fix: { op: "set", target: "258.7", text: { size: 28 } },
    },
    {
      code: "overflow",
      node: "258.8",
      measure: "text 86.4 pt, room 64.8",
      fix: { op: "set", target: "258.8", box: { h: 93.7 } },
    },
    {
      code: "off-slide",
      node: "258.9",
      measure: "12.5 pt past the edge",
      fix: { op: "set", target: "258.9", box: { x: 40, y: 30 } },
    },
    { code: "off-slide", node: "258.10", measure: "outside the slide" },
    {
      code: "overlap",
      node: "258.11",
      measure: "under 258.12",
      fix: { op: "set", target: "258.12", box: { x: 72, y: 300.5 } },
    },
    {
      code: "overlap",
      node: "258.11",
      measure: "crosses 258.13",
      fix: { op: "set", target: "258.13", box: { x: 72, y: 340 } },
    },
    {
      code: "small-text",
      node: "258.14",
      measure: "8 pt, under 10",
      fix: { op: "set", target: "258.14", text: { size: 10 } },
    },
    { code: "small-text", node: "258.15", measure: "7.5 pt, under 10" },
    {
      code: "low-contrast",
      node: "258.16",
      measure: "2.9:1, needs 4.5:1",
      fix: { op: "set", target: "258.16", text: { color: `#${green}` } },
    },
    { code: "low-contrast", node: "258.17", measure: "1:1, needs 3:1" },
    { code: "empty-placeholder", node: "258.18", measure: "empty subTitle", fix: { op: "delete", node: "258.18" } },

    {
      code: "misaligned",
      node: "258.19",
      measure: "2 pt off 258.20's top",
      fix: { op: "set", target: "258.19", box: { y: 100 } },
    },
    {
      code: "off-scale",
      node: "258.21",
      measure: "24 pt, Heading is 20",
      fix: { op: "set", target: "258.21", text: { size: 20 } },
    },
    { code: "off-scale", node: "258.22", measure: "13 pt, Caption is 11" },
  ])
})

it("keeps only the findings on the layers the answer shows", () => {
  const found = wire([
    { code: "small-text", node: "258.14", size: 8, min: 10, uniform: true },
    { code: "small-text", node: "259.2", size: 8, min: 10, uniform: true },
  ])
  expect(agentFindings(found, (node) => node.startsWith("259.")).map(({ node }) => node)).toEqual(["259.2"])
})

function report(raw: object): FindingsReport {
  const read = readFindingsReport({ deck: "deck", revision: 4, ...raw })
  if (!read.ok) throw new Error(read.refusal)
  return read
}

it("says what the tab knows about a revision in one short word when it has no list for it", () => {
  const found = report({ findings: [{ code: "small-text", node: "258.14", size: 8, min: 10, uniform: true }] })
  const all = () => true
  expect(findingsAt(undefined, 4, all)).toBe("missing")
  expect(findingsAt(found, 5, all)).toBe("pending 5")
  expect(findingsAt(report({ findings: [], broken: true }), 4, all)).toBe("broken 4")
  expect(findingsAt(found, 4, all)).toMatchObject([{ code: "small-text", node: "258.14" }])
  expect(findingsAt(found, 4, () => false)).toEqual([])
})
