export type BudgetDecisionName = "adopted" | "revised"

export type BudgetMetric = {
  id: string
  workload: string
  rule: string
  decision: BudgetDecisionName
  provisional: boolean
  measurement: string
  limits: Record<string, number>
}

export function phaseBudgetRules(phaseData: unknown): { id: string; workload: string; rule: string }[] {
  if (!phaseData || typeof phaseData !== "object") {
    return []
  }
  const packages = (phaseData as { workPackages?: unknown }).workPackages
  if (!packages || typeof packages !== "object") {
    return []
  }
  const rules: { id: string; workload: string; rule: string }[] = []
  for (const [id, value] of Object.entries(packages)) {
    const row = (value as { row?: unknown }).row
    if (!Array.isArray(row) || typeof row[10] !== "string" || typeof row[11] !== "string") {
      rules.push({ id, workload: "", rule: "" })
      continue
    }
    rules.push({ id, workload: row[10], rule: row[11] })
  }
  return rules
}

export function budgetInventoryErrors(phaseData: unknown, metrics: BudgetMetric[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const metric of metrics) {
    if (seen.has(metric.id)) {
      errors.push(`duplicate:${metric.id}`)
    }
    seen.add(metric.id)
    if (metric.decision !== "adopted" && metric.decision !== "revised") {
      errors.push(`decision:${metric.id}`)
    }
    if (typeof metric.provisional !== "boolean") {
      errors.push(`provisional:${metric.id}`)
    }
    if (typeof metric.measurement !== "string" || metric.measurement.length === 0) {
      errors.push(`measurement:${metric.id}`)
    }
    if (!metric.limits || typeof metric.limits !== "object" || Array.isArray(metric.limits)) {
      errors.push(`limits:${metric.id}`)
    }
  }
  for (const required of phaseBudgetRules(phaseData)) {
    const found = metrics.find((metric) => metric.id === required.id)
    if (!found) {
      errors.push(`missing:${required.id}`)
      continue
    }
    if (found.workload !== required.workload) {
      errors.push(`workload:${required.id}`)
    }
    if (found.rule !== required.rule) {
      errors.push(`rule:${required.id}`)
    }
  }
  return errors
}
