import { fileURLToPath } from "node:url"
import { previewPortLine } from "./preview-port.ts"
import { startPreview } from "./preview-server.mjs"
import { packageBuild } from "../../scripts/package-build.mjs"

const { fontMiddleware, LocalOriginalStore } = await packageBuild(
  fileURLToPath(new URL("../..", import.meta.url)),
  "@airdesign/api",
)

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
