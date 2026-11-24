import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "font-layout-notices",
      generateBundle(_options, bundle) {
        if (!Object.keys(bundle).some((file) => /^assets\/icu-breaks-.*\.wasm$/.test(file))) return
        const notices = new URL("../../packages/fonts/licenses/", import.meta.url)
        for (const name of readdirSync(notices))
          this.emitFile({
            type: "asset",
            fileName: `assets/font-layout-licenses/${name}`,
            source: readFileSync(new URL(name, notices)),
          })
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
