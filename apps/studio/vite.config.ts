import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@airdesign/ui": path.resolve("../../packages/ui/src/index.ts"),
      "@airdesign/access/client": path.resolve("../../packages/access/src/client/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 41732,
    proxy: {
      "/ws": { target: process.env.AIRDESIGN_API_ORIGIN ?? "http://127.0.0.1:41731", ws: true },
      "/mcp": { target: process.env.AIRDESIGN_API_ORIGIN ?? "http://127.0.0.1:41731", changeOrigin: false },
      "/oauth": process.env.AIRDESIGN_API_ORIGIN ?? "http://127.0.0.1:41731",
      "/.well-known": process.env.AIRDESIGN_API_ORIGIN ?? "http://127.0.0.1:41731",
      "/api": process.env.AIRDESIGN_API_ORIGIN ?? "http://127.0.0.1:41731",
    },
  },
})
