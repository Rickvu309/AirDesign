import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { describe, it } from "vitest"
import { performanceBudgets } from "../../packages/contract-rules/src/budgets.ts"
import { evaluateContractCase } from "../../packages/contract-rules/src/evaluate-case.ts"
import { validateContractDocument } from "../../packages/contract-rules/src/contract-document.ts"
import { runTextSpanProbe } from "../../packages/contract-rules/src/text-span-probe.ts"

const root = path.resolve(import.meta.dirname, "../..")
const contractsDir = path.join(root, "docs/contracts")

describe("accepted contract bundle", () => {
  it("accepts every P01 contract and leaves later contracts owned and deferred", async () => {
    const program = JSON.parse(await readFile(path.join(root, "program/contract-index.json"), "utf8")) as {
      contracts: Record<string, { freezeIn: string; status: string; owner: string; decision: string; sourceGitSha: string }>
      prReferences: Record<string, string[]>
    }
    const p01 = program.prReferences.P01
    assert.ok(p01)
    for (const id of p01) {
      const entry = program.contracts[id]
      assert.equal(entry?.status, "accepted")
      assert.equal(entry?.freezeIn, "P01")
      assert.equal(entry?.sourceGitSha, "1ead9f54adee48bfefbe1057c24ed3fdd08af361")
      assert.ok(entry?.owner)
      const document = JSON.parse(await readFile(path.join(root, entry.decision), "utf8")) as unknown
      const validated = validateContractDocument(document)
      assert.equal(validated.ok, true)
      if (validated.ok) {
        assert.equal(validated.document.status, "accepted")
        assert.ok(validated.document.counterexamples.length > 0)
      }
    }
    for (const [id, entry] of Object.entries(program.contracts)) {
      if (entry.freezeIn === "P01") {
        continue
      }
      assert.equal(entry.status, "deferred", id)
      assert.match(entry.freezeIn, /^P0[2-9]$/)
      assert.ok(entry.owner)
      const document = JSON.parse(await readFile(path.join(root, entry.decision), "utf8")) as { rule: null }
      assert.equal(document.rule, null)
    }
  })

  it("runs the executable examples and counterexamples", async () => {
    const files = (await readdir(contractsDir)).filter((name) => /^c0[123]-/.test(name))
    assert.equal(files.length, 3)
    for (const file of files) {
      const document = JSON.parse(await readFile(path.join(contractsDir, file), "utf8")) as {
        id: string
        examples: { body: unknown; expect: Record<string, unknown> }[]
        counterexamples: { id: string; body: unknown; expect: Record<string, unknown> }[]
      }
      for (const item of [...document.examples, ...document.counterexamples]) {
        const result = evaluateContractCase(document.id, item.body, item.expect)
        assert.equal(result.pass, true, `${document.id} ${JSON.stringify(result.actual)}`)
      }
      if (document.id === "C02") {
        const adopted = document.counterexamples[0]?.expect.adopted as { id: string; parentId: string; text: string }[]
        assert.equal(adopted[0]?.id, "child-c")
        assert.equal(adopted[0]?.parentId, "parent-q")
        assert.equal(adopted[0]?.text, "person note")
      }
    }
  })

  it("rejects a contract id and a missing source sha", () => {
    const badId = validateContractDocument({ schemaVersion: 1, id: "C1" })
    assert.equal(badId.ok, false)
    const missingSha = validateContractDocument({
      id: "C01",
      schemaVersion: 1,
      title: "Example",
      status: "accepted",
      freezeIn: "P01",
      acceptIn: "P01",
      owner: "packages/contract-rules",
      source: { path: "docs/planning/v0.1/content/engine-constraints.md" },
      rule: "A rule.",
      alternatives: ["Another rule."],
      examples: [{}],
      counterexamples: [{}],
      evidence: { kind: "record", command: "npm run verify:contracts" },
      migration: { policy: "additive-only", from: null },
    })
    assert.equal(missingSha.ok, false)
    if (!missingSha.ok) {
      assert.ok(missingSha.errors.includes("source.gitSha"))
    }
  })

  it("keeps the schema on stable ids, provenance, and additive migration", async () => {
    const schema = JSON.parse(await readFile(path.join(contractsDir, "contract.schema.json"), "utf8")) as {
      properties: { id: { pattern: string }; source: { required: string[] }; migration: { properties: { policy: { const: string } } } }
    }
    assert.equal(schema.properties.id.pattern, "^C[0-9]{2}$")
    assert.deepEqual(schema.properties.source.required, ["path", "gitSha"])
    assert.equal(schema.properties.migration.properties.policy.const, "additive-only")
  })
})

describe("feasibility inventories", () => {
  it("classifies every fixture feature as proven or unproven", async () => {
    const matrix = JSON.parse(await readFile(path.join(contractsDir, "support-matrix.json"), "utf8")) as {
      features: { feature: string; support: string; status: string }[]
    }
    const supports = new Set(["native", "kept", "flagged"])
    assert.ok(matrix.features.length > 0)
    for (const feature of matrix.features) {
      assert.ok(supports.has(feature.support), feature.feature)
      assert.ok(feature.status === "proven" || feature.status === "unproven")
    }
  })

  it("gives every font a hash or an explicit unresolved entry", async () => {
    const inventory = JSON.parse(await readFile(path.join(contractsDir, "font-inventory.json"), "utf8")) as {
      fonts: { name: string; license: string; sha256: string | null; status: string; reason?: string }[]
    }
    for (const font of inventory.fonts) {
      const hashed = typeof font.sha256 === "string" && /^[0-9a-f]{64}$/.test(font.sha256)
      const unresolved = font.status === "unresolved" && typeof font.reason === "string" && font.license.length > 0
      assert.ok(hashed || unresolved, font.name)
    }
  })

  it("declares hostile limits and leaves external gates unpassed", async () => {
    const hostile = JSON.parse(await readFile(path.join(contractsDir, "hostile-file-expectations.json"), "utf8")) as {
      limits: { zipBytes: number; unpackedBytes: number; parts: number; wallMs: number; memoryBytes: number; networkEgress: string; temp: string }
      hostileFont: { caseId: string; owner: string; status: string }
    }
    assert.equal(hostile.limits.zipBytes, performanceBudgets.workerZipBytes)
    assert.equal(hostile.limits.unpackedBytes, performanceBudgets.workerUnpackedBytes)
    assert.equal(hostile.limits.parts, performanceBudgets.workerParts)
    assert.equal(hostile.limits.wallMs, performanceBudgets.workerWallMs)
    assert.equal(hostile.limits.memoryBytes, performanceBudgets.workerRssBytes)
    assert.equal(hostile.limits.networkEgress, "none")
    assert.equal(hostile.limits.temp, "per-owner-job")
    assert.equal(hostile.hostileFont.caseId, "font-zip-bomb")
    assert.equal(hostile.hostileFont.owner, "P03")
    assert.equal(hostile.hostileFont.status, "unproven")
    const external = JSON.parse(await readFile(path.join(contractsDir, "external-evidence.json"), "utf8")) as {
      entries: { id: string; passed: boolean; gate: string }[]
    }
    const windows = external.entries.find((entry) => entry.id === "windows-powerpoint")
    const mac = external.entries.find((entry) => entry.id === "mac-powerpoint")
    const reader = external.entries.find((entry) => entry.id === "screen-reader")
    assert.equal(windows?.passed, false)
    assert.equal(windows?.gate, "X01")
    assert.equal(mac?.passed, false)
    assert.equal(mac?.gate, "X01")
    assert.equal(reader?.passed, false)
    assert.equal(reader?.gate, "X02")
  })

  it("keeps the PDF deadline distinct from import and tool budgets", () => {
    assert.notEqual(performanceBudgets.pdfDeadlineMs, performanceBudgets.importWallMs)
    assert.notEqual(performanceBudgets.toolReadWarmP95Ms, performanceBudgets.importWallMs)
    assert.equal(performanceBudgets.authWarmP95Ms, 500)
    assert.equal(performanceBudgets.fixtureCliWallMs, 30_000)
  })
})

describe("text span probe", () => {
  it("changes one span and keeps the other part hashes", async () => {
    const report = await runTextSpanProbe(path.join(root, "fixtures/pptx/text-span-two-runs"))
    assert.equal(report.unchangedPartHashesMatch, true)
    assert.deepEqual(report.changedParts, ["slide.xml"])
    assert.deepEqual(report.unchangedSpanIds, ["r1"])
    assert.equal(report.lineCountDelta, 0)
    assert.equal(report.repairPrompt, false)
    assert.equal(report.referenceImage.status, "unproven")
    assert.equal(report.referenceImage.gate, "X01")
    assert.ok(report.wallMs < performanceBudgets.fixtureCliWallMs)
    assert.ok(report.peakRssBytes < performanceBudgets.fixtureCliPeakRssBytes)
  })
})
