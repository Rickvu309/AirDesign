const patience = 10_000

export function within<T>(work: Promise<T>, said: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const hung = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${said} did not finish`)), patience)
  })
  return Promise.race([work, hung]).finally(() => clearTimeout(timer))
}

export async function until(reached: () => boolean, said: string): Promise<void> {
  const deadline = Date.now() + patience
  while (!reached()) {
    if (Date.now() > deadline) throw new Error(`${said} never came`)
    await new Promise((done) => setTimeout(done, 1))
  }
}
