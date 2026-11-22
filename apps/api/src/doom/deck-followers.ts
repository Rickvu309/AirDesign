export const followGrace = 10_000

export class DeckFollowers {
  private readonly held = new Map<string, number>()
  private readonly left = new Map<string, number>()
  private readonly now: () => number

  constructor(now: () => number) {
    this.now = now
  }

  follow(deck: string): () => void {
    this.held.set(deck, (this.held.get(deck) ?? 0) + 1)
    let gone = false
    return () => {
      if (gone) return
      gone = true
      const held = (this.held.get(deck) ?? 1) - 1
      if (held > 0) this.held.set(deck, held)
      else this.held.delete(deck)
      this.left.set(deck, this.now())
    }
  }

  following(deck: string): boolean {
    if ((this.held.get(deck) ?? 0) > 0) return true
    const left = this.left.get(deck)
    return left !== undefined && this.now() - left < followGrace
  }
}
