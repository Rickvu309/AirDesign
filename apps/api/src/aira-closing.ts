export const closeBound = 5_000

export class Closing {
  private readonly stopping = new Map<string, Promise<void>>()
  private readonly bound: number

  constructor(bound: number = closeBound) {
    this.bound = bound
  }

  follow(account: string, signal: AbortSignal): () => void {
    let close = (): void => undefined
    const closed = new Promise<void>((resolve) => {
      close = resolve
    })
    const stop = (): void => {
      this.stopping.set(account, closed)
    }
    if (signal.aborted) stop()
    else signal.addEventListener("abort", stop, { once: true })
    return () => {
      signal.removeEventListener("abort", stop)
      if (this.stopping.get(account) === closed) this.stopping.delete(account)
      close()
    }
  }

  async closed(account: string): Promise<boolean> {
    const turn = this.stopping.get(account)
    if (turn === undefined) return false
    let timer: NodeJS.Timeout | undefined
    const late = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.bound)
    })
    await Promise.race([turn, late])
    clearTimeout(timer)
    return true
  }
}
