import { fileURLToPath } from "node:url"
import { fontMiddleware, LocalOriginalStore } from "../../apps/api/dist/index.js"
import { previewPortLine } from "./preview-port.ts"
import { startPreview } from "./preview-server.mjs"

const fonts = fontMiddleware(new LocalOriginalStore())
const { port } = await startPreview({
  root: fileURLToPath(new URL("../../apps/web", import.meta.url)),
  start: Number(process.argv[2]),
  plugins: [
    {
      name: "font-source",
      configurePreviewServer: (server) => {
        server.middlewares.use(fonts)
      },
    },
  ],
})
console.log(previewPortLine(port))
