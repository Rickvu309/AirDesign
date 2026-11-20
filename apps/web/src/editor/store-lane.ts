export type StoreLane = <Result>(change: (stored: () => void) => Promise<Result>) => Promise<Result>

export function storeLane(): StoreLane {
  let last: Promise<void> = Promise.resolve()
  return async (change) => {
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
}
