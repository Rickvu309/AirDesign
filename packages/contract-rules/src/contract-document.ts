const contractIdPattern = /^C[0-9]{2}$/
const shaPattern = /^[0-9a-f]{40}$/
const prPattern = /^P0[1-9]$/
const statuses = ["accepted", "deferred"] as const

export type ContractStatus = (typeof statuses)[number]

export type ContractDocument = {
  id: string
  schemaVersion: 1
  title: string
  status: ContractStatus
  freezeIn: string
  acceptIn: string
  owner: string
  source: { path: string; gitSha: string }
  rule: string | null
  alternatives: string[]
  examples: unknown[]
  counterexamples: unknown[]
  evidence: { kind: string; command: string }
  migration: { policy: "additive-only"; from: number | null }
}

export type ContractValidation =
  | { ok: true; document: ContractDocument }
  | { ok: false; errors: string[] }

export function validateContractDocument(value: unknown): ContractValidation {
  const errors: string[] = []
  if (!value || typeof value !== "object") {
    return { ok: false, errors: ["document"] }
  }
  const document = value as Record<string, unknown>
  if (document.schemaVersion !== 1) {
    errors.push("schemaVersion")
  }
  if (typeof document.id !== "string" || !contractIdPattern.test(document.id)) {
    errors.push("id")
  }
  if (typeof document.title !== "string" || document.title.length === 0) {
    errors.push("title")
  }
  if (!statuses.includes(document.status as ContractStatus)) {
    errors.push("status")
  }
  if (typeof document.freezeIn !== "string" || !prPattern.test(document.freezeIn)) {
    errors.push("freezeIn")
  }
  if (typeof document.acceptIn !== "string" || !prPattern.test(document.acceptIn)) {
    errors.push("acceptIn")
  }
  if (typeof document.owner !== "string" || document.owner.length === 0) {
    errors.push("owner")
  }
  const source = document.source
  if (!source || typeof source !== "object") {
    errors.push("source")
  } else {
    const sourceRecord = source as Record<string, unknown>
    if (typeof sourceRecord.path !== "string" || sourceRecord.path.length === 0) {
      errors.push("source.path")
    }
    if (typeof sourceRecord.gitSha !== "string" || !shaPattern.test(sourceRecord.gitSha)) {
      errors.push("source.gitSha")
    }
  }
  if (!(typeof document.rule === "string" || document.rule === null)) {
    errors.push("rule")
  }
  if (!Array.isArray(document.alternatives) || document.alternatives.some((item) => typeof item !== "string")) {
    errors.push("alternatives")
  }
  if (!Array.isArray(document.examples)) {
    errors.push("examples")
  }
  if (!Array.isArray(document.counterexamples)) {
    errors.push("counterexamples")
  }
  const evidence = document.evidence
  if (!evidence || typeof evidence !== "object") {
    errors.push("evidence")
  } else {
    const evidenceRecord = evidence as Record<string, unknown>
    if (typeof evidenceRecord.kind !== "string" || typeof evidenceRecord.command !== "string") {
      errors.push("evidence.fields")
    }
  }
  const migration = document.migration
  if (!migration || typeof migration !== "object") {
    errors.push("migration")
  } else {
    const migrationRecord = migration as Record<string, unknown>
    if (migrationRecord.policy !== "additive-only") {
      errors.push("migration.policy")
    }
    if (!(migrationRecord.from === null || typeof migrationRecord.from === "number")) {
      errors.push("migration.from")
    }
  }
  if (document.status === "accepted") {
    if (typeof document.rule !== "string" || document.rule.length === 0) {
      errors.push("accepted.rule")
    }
    if (!Array.isArray(document.examples) || document.examples.length === 0) {
      errors.push("accepted.examples")
    }
    if (!Array.isArray(document.counterexamples) || document.counterexamples.length === 0) {
      errors.push("accepted.counterexamples")
    }
    if (!Array.isArray(document.alternatives) || document.alternatives.length === 0) {
      errors.push("accepted.alternatives")
    }
  }
  if (document.status === "deferred" && document.rule !== null) {
    errors.push("deferred.rule")
  }
  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, document: document as unknown as ContractDocument }
}
