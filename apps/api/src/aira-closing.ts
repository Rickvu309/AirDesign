export const closeBound = 5_000

export type Followed = { readonly signal: AbortSignal; readonly done: () => void }

type Running = { readonly stop: AbortController; readonly closed: Promise<void> }

export class Closing {
  private readonly stopping = new Map<string, Promise<void>>()
  private readonly asks = new Map<string, Running>()
  private readonly bound: number

  constructor(bound: number = closeBound) {
    this.bound = bound
  }

  follow(account: string, ask: string | undefined, left: AbortSignal): Followed {
    const stop = new AbortController()
    const signal = AbortSignal.any([left, stop.signal])
    let close = (): void => undefined
    const closed = new Promise<void>((resolve) => {
      close = resolve
    })
    const mark = (): void => {
      this.stopping.set(account, closed)
    }
    if (signal.aborted) mark()
    else signal.addEventListener("abort", mark, { once: true })
    const named = ask === undefined ? undefined : `${account}\n${ask}`
    if (named !== undefined) this.asks.set(named, { stop, closed })
    return {
      signal,
      done: () => {
        signal.removeEventListener("abort", mark)
        if (this.stopping.get(account) === closed) this.stopping.delete(account)
        if (named !== undefined && this.asks.get(named)?.closed === closed) this.asks.delete(named)
        close()
      },
    }
  }

  async stop(account: string, ask: string): Promise<void> {
    const running = this.asks.get(`${account}\n${ask}`)
    if (running === undefined) return
    running.stop.abort()
    await this.within(running.closed)
  }

  async closed(account: string): Promise<boolean> {
    const turn = this.stopping.get(account)
    if (turn === undefined) return false
    await this.within(turn)
    return true
  }

  private async within(turn: Promise<void>): Promise<void> {
    let timer: NodeJS.Timeout | undefined
    const late = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.bound)
    })
    await Promise.race([turn, late])
    clearTimeout(timer)
  }
}
