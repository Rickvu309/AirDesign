import { createServer } from "node:net"

export const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address === null || typeof address === "string") {
        server.close()
        reject(new Error("port"))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })

const portTaken = /Address already in use|could not create any TCP\/IP sockets/

export async function onFreePort<T>({
  pick = freePort,
  start,
  tries = 5,
}: {
  readonly pick?: (() => Promise<number>) | undefined
  readonly start: (port: number) => Promise<T>
  readonly tries?: number
}): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await start(await pick())
    } catch (error) {
      const refusedForPort = error instanceof Error && portTaken.test(error.message)
      if (!refusedForPort || attempt >= tries) throw error
    }
  }
}
