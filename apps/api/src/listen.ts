import { Client, type Notification } from "pg"

export type CaughtRevision = {
  readonly id: string
  readonly revision: number
}

export class DeckListen {
  private client: Client | undefined
  private trusted = false
  private stopped = true
  private opening: Promise<void> | undefined
  private pendingWake = false
  private caught: CaughtRevision[] = []
  private readonly waiters = new Set<() => void>()
  private readonly connectionString: string

  constructor(connectionString: string) {
    this.connectionString = connectionString
  }

  revisions(): readonly CaughtRevision[] {
    return this.caught
  }

  async open(): Promise<void> {
    this.stopped = false
    await this.ensure()
  }

  async close(): Promise<void> {
    this.stopped = true
    this.trusted = false
    this.pendingWake = false
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

  wait(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.resolve()
    return new Promise((resolve) => {
      const finish = () => {
        this.waiters.delete(finish)
        signal.removeEventListener("abort", finish)
        resolve()
      }
      this.waiters.add(finish)
      signal.addEventListener("abort", finish, { once: true })
    })
  }

  private wake(): void {
    for (const waiter of [...this.waiters]) waiter()
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
    this.pendingWake = false
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
      if (this.client !== client) return
      if (message.channel !== "deck") return
      if (!this.trusted) {
        this.pendingWake = true
        return
      }
      this.wake()
    })
    await client.connect()
    if (this.stopped) {
      client.removeAllListeners()
      await client.end().catch(() => undefined)
      return
    }
    await client.query("listen deck")
    const seen = await client.query<{ id: string; revision: number }>("select id, revision from deck.saved")
    if (this.stopped) {
      client.removeAllListeners()
      await client.end().catch(() => undefined)
      return
    }
    this.caught = seen.rows.map((row) => ({ id: row.id, revision: row.revision }))
    this.client = client
    this.trusted = true
    if (this.pendingWake) {
      this.pendingWake = false
      this.wake()
    }
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
