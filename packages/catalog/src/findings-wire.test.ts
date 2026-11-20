import { limits } from "@airdesign/document"
import { expect, it } from "vitest"
import { deckRoutes, readFindingsReport } from "./index.js"

const overflow = { node: "258.7", needed: 86.4, room: 64.8, fix: { size: 28, height: 93.6 } }
const report = { deck: "deck", revision: 3, overflow: [overflow] }

it("reads a tab's overflow report for one revision and keeps the route in the catalog", () => {
  expect(readFindingsReport(report)).toEqual({ ok: true, ...report })
  expect(deckRoutes.findings.read(report)).toEqual({ ok: true, ...report })
  expect(readFindingsReport({ ...report, overflow: [] })).toEqual({ ok: true, ...report, overflow: [] })
  const unsized = { ...overflow, fix: { size: null, height: 93.6 } }
  expect(readFindingsReport({ ...report, overflow: [unsized] })).toEqual({ ok: true, ...report, overflow: [unsized] })
  expect(deckRoutes.findings.result({ ok: true, deck: "deck" })).toEqual({ ok: true, deck: "deck" })
})

it("refuses a report it cannot trust", () => {
  expect(readFindingsReport({ ...report, deck: "a b" })).toEqual({ ok: false, refusal: "deck" })
  const field = { ok: false, refusal: "field" }
  for (const raw of [
    null,
    [],
    { deck: "deck", revision: 3 },
    { deck: "deck", overflow: [] },
    { ...report, actor: "person" },
    { ...report, revision: -1 },
    { ...report, revision: 1.5 },
    { ...report, overflow: {} },
    { ...report, overflow: [overflow, overflow] },
    {
      ...report,
      overflow: Array.from({ length: limits.elements + 1 }, (_, at) => ({ ...overflow, node: `258.${at}` })),
    },
    { ...report, overflow: [{ ...overflow, node: "nope" }] },
    { ...report, overflow: [{ ...overflow, needed: -1 }] },
    { ...report, overflow: [{ ...overflow, room: Number.NaN }] },
    { ...report, overflow: [{ ...overflow, needed: "86" }] },
    { ...report, overflow: [{ ...overflow, extra: 1 }] },
    { ...report, overflow: [{ ...overflow, fix: { size: 0, height: 93.6 } }] },
    { ...report, overflow: [{ ...overflow, fix: { size: 2.5, height: 93.6 } }] },
    { ...report, overflow: [{ ...overflow, fix: { size: 28 } }] },
    { ...report, overflow: [{ ...overflow, fix: { size: 28, height: 93.6, x: 1 } }] },
  ])
    expect(readFindingsReport(raw)).toEqual(field)
})
