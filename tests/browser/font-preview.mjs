import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import { fontMiddleware, LocalOriginalStore } from "../../apps/api/dist/index.js"

const root = fileURLToPath(new URL("../../apps/web", import.meta.url))
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url))
const { preview } = await import(pathToFileURL(require.resolve("vite")).href)
const fonts = fontMiddleware(new LocalOriginalStore())
await preview({
  root,
  preview: { host: "127.0.0.1", port: Number(process.argv[2]), strictPort: true },
  plugins: [
    {
      name: "font-source",
      configurePreviewServer: (server) => {
        server.middlewares.use(fonts)
      },
    },
  ],
})
