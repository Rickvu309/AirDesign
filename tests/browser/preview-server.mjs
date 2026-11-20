import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

export const startPreview = async ({ root, start, plugins = [] }) => {
  const require = createRequire(new URL("../../apps/web/package.json", import.meta.url))
  const { preview } = await import(pathToFileURL(require.resolve("vite")).href)
  const server = await preview({
    root,
    preview: { host: "127.0.0.1", port: start, strictPort: false },
    plugins,
  })
  const { port } = server.httpServer.address()
  return { port, close: () => server.close() }
}
