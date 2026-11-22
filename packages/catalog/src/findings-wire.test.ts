import { limits } from "@airdesign/document"
import { expect, it } from "vitest"
import { deckRoutes, readFindingsReport } from "./index.js"

const overflow = { code: "overflow", node: "258.7", needed: 86.4, room: 64.8, size: 28, height: 93.6 }
const findings = [
  overflow,
  { code: "overflow", node: "258.8", needed: 86.4, room: 64.8, size: null, height: 93.6 },
  { code: "off-slide", node: "258.9", past: 12.5, whole: false, x: 40, y: 30 },
  { code: "off-slide", node: "258.10", past: 0, whole: true, x: null, y: null },
  { code: "overlap", node: "258.11", other: "258.12", by: "cover", x: 72, y: 300.5 },
  { code: "small-text", node: "258.13", size: 8, min: 10, uniform: true },
  { code: "low-contrast", node: "258.14", ratio: 2.87, needs: 4.5, color: "1A7A33" },
  { code: "low-contrast", node: "258.15", ratio: 2.87, needs: 4.5, color: null },
  { code: "empty-placeholder", node: "258.16", placeholder: "subTitle" },
  { code: "misaligned", node: "258.17", other: "258.18", edge: "left", by: 1.5, x: 72, y: null },
  { code: "off-scale", node: "258.19", size: 24, to: 20, style: "Heading", uniform: true },
]
const report = { deck: "deck", revision: 3, findings }

it("reads a tab's findings report for one revision and keeps the route in the catalog", () => {
  expect(readFindingsReport(report)).toEqual({ ok: true, ...report })
  expect(deckRoutes.findings.read(report)).toEqual({ ok: true, ...report })
  expect(readFindingsReport({ ...report, findings: [] })).toEqual({ ok: true, ...report, findings: [] })
  const twice = [overflow, { ...findings[6], node: "258.7" }]
  expect(readFindingsReport({ ...report, findings: twice })).toEqual({ ok: true, ...report, findings: twice })
  expect(deckRoutes.findings.result({ ok: true, deck: "deck" })).toEqual({ ok: true, deck: "deck" })
  const broken = { ...report, findings: [], broken: true }
  expect(readFindingsReport(broken)).toEqual({ ok: true, ...broken })
})

it("refuses a report it cannot trust", () => {
  expect(readFindingsReport({ ...report, deck: "a b" })).toEqual({ ok: false, refusal: "deck" })
  const field = { ok: false, refusal: "field" }
  for (const raw of [
    null,
    [],
    { deck: "deck", revision: 3 },
    { deck: "deck", findings: [] },
    { ...report, actor: "person" },
    { ...report, revision: -1 },
    { ...report, revision: 1.5 },
    { ...report, findings: {} },
    { ...report, overflow: [] },
    { ...report, broken: true },
    { ...report, findings: [], broken: false },
    {
      ...report,
      findings: Array.from({ length: limits.elements * 4 + 1 }, (_, at) => ({ ...overflow, node: `258.${at}` })),
    },
    { ...report, findings: [{ ...overflow, code: "nope" }] },
    { ...report, findings: [{ ...overflow, node: "nope" }] },
    { ...report, findings: [{ ...overflow, needed: -1 }] },
    { ...report, findings: [{ ...overflow, room: Number.NaN }] },
    { ...report, findings: [{ ...overflow, needed: "86" }] },
    { ...report, findings: [{ ...overflow, extra: 1 }] },
    { ...report, findings: [{ ...overflow, size: 0 }] },
    { ...report, findings: [{ ...overflow, size: 2.5 }] },
    { ...report, findings: [{ code: "overflow", node: "258.7", needed: 86.4, room: 64.8, size: 28 }] },
    { ...report, findings: [{ ...findings[2], x: 40, y: null }] },
    { ...report, findings: [{ ...findings[2], x: -200_000 }] },
    { ...report, findings: [{ ...findings[4], other: "nope" }] },
    { ...report, findings: [{ ...findings[4], by: "glyph" }] },
    { ...report, findings: [{ ...findings[5], uniform: "yes" }] },
    { ...report, findings: [{ ...findings[6], color: `#${"1A7A33"}` }] },
    { ...report, findings: [{ ...findings[6], ratio: 30 }] },
    { ...report, findings: [{ ...findings[8], placeholder: "" }] },
    { ...report, findings: [{ ...findings[9], y: 30 }] },
    { ...report, findings: [{ ...findings[9], x: null }] },
    { ...report, findings: [{ ...findings[9], edge: "centre" }] },
  ])
    expect(readFindingsReport(raw)).toEqual(field)
})
