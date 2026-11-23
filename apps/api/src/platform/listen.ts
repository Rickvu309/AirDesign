import { Client, type Notification } from "pg"

export type Topic = "aira" | { readonly deck: string }

const deckOf = (payload: string | undefined) => payload?.slice(0, payload.lastIndexOf(":")) ?? ""

export class DeckListen {
  private client: Client | undefined
  private trusted = false
  private stopped = true
  private opening: Promise<void> | undefined
  private readonly aira = new Set<() => void>()
  private readonly decks = new Map<string, Set<() => void>>()
  private readonly connectionString: string

  constructor(connectionString: string) {
    this.connectionString = connectionString
  }

  async open(): Promise<void> {
    this.stopped = false
    await this.ensure()
  }

  async close(): Promise<void> {
    this.stopped = true
    this.trusted = false
    const client = this.client
    this.client = undefined
    this.opening = undefined
    if (client === undefined) return
    client.removeAllListeners()
    await client.end().catch(() => undefined)
  }

  async ready(): Promise<void> {
    if (this.stopped) {
      await this.open()
      return
    }
    await this.ensure()
  }

  wait(signal: AbortSignal, topic: Topic): Promise<void> {
    if (signal.aborted) return Promise.resolve()
    const deck = topic === "aira" ? undefined : topic.deck
    const waiters = deck === undefined ? this.aira : (this.decks.get(deck) ?? new Set())
    if (deck !== undefined) this.decks.set(deck, waiters)
    return new Promise((resolve) => {
      const finish = () => {
        waiters.delete(finish)
        if (deck !== undefined && waiters.size === 0 && this.decks.get(deck) === waiters) this.decks.delete(deck)
        signal.removeEventListener("abort", finish)
        resolve()
      }
      waiters.add(finish)
      signal.addEventListener("abort", finish, { once: true })
    })
  }

  private wake(waiters: Set<() => void> | undefined): void {
    for (const waiter of [...(waiters ?? [])]) waiter()
  }

  private wakeEveryone(): void {
    this.wake(this.aira)
    for (const waiters of [...this.decks.values()]) this.wake(waiters)
  }

  private async ensure(): Promise<void> {
    if (this.stopped) return
    if (this.client !== undefined && this.trusted) return
    if (this.opening !== undefined) {
      await this.opening
      return
    }
    const opening = this.connect()
    this.opening = opening
    try {
      await opening
    } finally {
      if (this.opening === opening) this.opening = undefined
    }
  }

  private async connect(): Promise<void> {
    this.trusted = false
    const previous = this.client
    this.client = undefined
    if (previous !== undefined) {
      previous.removeAllListeners()
      await previous.end().catch(() => undefined)
    }
    if (this.stopped) return
    const client = new Client({
      connectionString: this.connectionString,
      application_name: "api-listen",
    })
    client.on("error", () => {
      this.fail(client)
    })
    client.on("end", () => {
      this.fail(client)
    })
    client.on("notification", (message: Notification) => {
      if (this.client !== client || !this.trusted) return
      if (message.channel === "aira") this.wake(this.aira)
      if (message.channel === "deck") this.wake(this.decks.get(deckOf(message.payload)))
    })
    await client.connect()
    if (this.stopped) {
      client.removeAllListeners()
      await client.end().catch(() => undefined)
      return
    }
    await client.query("listen deck")
    await client.query("listen aira")
    this.client = client
    this.trusted = true
    this.wakeEveryone()
  }

  private fail(client: Client): void {
    if (this.client !== client) return
    this.client = undefined
    this.trusted = false
    client.removeAllListeners()
    void client.end().catch(() => undefined)
    if (this.stopped) return
    void this.ensure().catch(() => undefined)
  }
}
