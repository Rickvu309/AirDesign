import { fileURLToPath } from "node:url"
import { fontShelf, offShelf, shelfFolder, shelveFonts } from "../../scripts/font-shelf.mjs"
import { previewPortLine } from "./preview-port.ts"
import { startPreview } from "./preview-server.mjs"
import { packageBuild } from "../../scripts/package-build.mjs"

const { FontSource, fontMiddleware } = await packageBuild(
  fileURLToPath(new URL("../..", import.meta.url)),
  "@airdesign/api",
)

const shelf = fontShelf(shelfFolder)
await shelveFonts(new FontSource(shelf))
const fonts = fontMiddleware(new FontSource(shelf, offShelf))
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
