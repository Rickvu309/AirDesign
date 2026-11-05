import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "packages/ui/src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    outDir: "packages/ui/dist",
    emptyOutDir: true,
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "sonner", "cmdk"],
    },
  },
})
