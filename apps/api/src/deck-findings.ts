import type { DeckId, FindingsReport } from "@airdesign/catalog"

export const keptDecks = 1_000

export class DeckFindings {
  private readonly reports = new Map<DeckId, FindingsReport>()
  private readonly waiting = new Map<DeckId, Set<() => void>>()

  keep(report: FindingsReport): void {
    const held = this.reports.get(report.deck)
    if (held !== undefined && held.revision > report.revision) return
    this.reports.delete(report.deck)
    this.reports.set(report.deck, report)
    const oldest = this.reports.size > keptDecks ? this.reports.keys().next().value : undefined
    if (oldest !== undefined) this.reports.delete(oldest)
    const woken = this.waiting.get(report.deck) ?? new Set()
    this.waiting.delete(report.deck)
    for (const wake of woken) wake()
  }

  latest(deck: DeckId): FindingsReport | undefined {
    return this.reports.get(deck)
  }

  wait(deck: DeckId, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve()
        return
      }
      const wake = () => {
        signal.removeEventListener("abort", stop)
        resolve()
      }
      const stop = () => {
        this.waiting.get(deck)?.delete(wake)
        resolve()
      }
      const held = this.waiting.get(deck) ?? new Set()
      held.add(wake)
      this.waiting.set(deck, held)
      signal.addEventListener("abort", stop, { once: true })
    })
  }
}
