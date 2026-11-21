export type StoreLane = {
  <Result>(change: (stored: () => void) => Promise<Result>): Promise<Result>
  readonly stored: () => Promise<void>
}

export function storeLane(): StoreLane {
  let last: Promise<void> = Promise.resolve()
  async function run<Result>(change: (stored: () => void) => Promise<Result>): Promise<Result> {
    const earlier = last
    let stored = () => undefined as void
    last = new Promise((done) => {
      stored = done
    })
    await earlier
    try {
      return await change(stored)
    } finally {
      stored()
    }
  }
  return Object.assign(run, { stored: () => last })
}
