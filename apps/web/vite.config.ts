import { existsSync } from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin, type Rollup } from "vite"

const offlineModules = ["src/thin-deck.tsx", "src/editing/import-deck.ts", "src/decks/first-slide.ts"].map((file) =>
  path.resolve(import.meta.dirname, file),
)
const missingOffline = offlineModules.filter((file) => !existsSync(file))
if (missingOffline.length > 0)
  throw new Error(`offlineModules names files that do not exist: ${missingOffline.join(", ")}`)

const homePaths = ["/", "/all", "/trash"]

function preloadOfflineModules(): Plugin {
  return {
    name: "preload-offline-modules",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, { bundle }) {
        if (bundle === undefined) return []
        const chunks = Object.values(bundle).filter((output): output is Rollup.OutputChunk => output.type === "chunk")
        const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
        const reached = (files: readonly string[], seen = new Set<string>()): Set<string> => {
          for (const file of files) {
            if (seen.has(file)) continue
            seen.add(file)
            reached(byFile.get(file)?.imports ?? [], seen)
          }
          return seen
        }
        const first = reached(chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName))
        const offline = chunks.filter((chunk) => chunk.moduleIds.some((id) => offlineModules.includes(id)))
        const files = [...reached(offline.map((chunk) => chunk.fileName))].filter((file) => !first.has(file))
        return [
          {
            tag: "script",
            children: `if (${JSON.stringify(homePaths)}.includes(location.pathname.replace(/\\/$/, "") || "/")) for (const file of ${JSON.stringify(files.map((file) => `/${file}`))}) document.head.append(Object.assign(document.createElement("link"), { rel: "modulepreload", crossOrigin: "", href: file }))`,
            injectTo: "head" as const,
          },
        ]
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadOfflineModules()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
