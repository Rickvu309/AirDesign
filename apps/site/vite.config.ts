import {defineConfig} from "vite"
import {resolve} from "node:path"
export default defineConfig({build:{rollupOptions:{input:{examples:resolve(import.meta.dirname,"examples/index.html"),landing:resolve(import.meta.dirname,"index.html"),pricing:resolve(import.meta.dirname,"pricing/index.html"),agents:resolve(import.meta.dirname,"agents/index.html"),claude:resolve(import.meta.dirname,"agents/claude/index.html"),codex:resolve(import.meta.dirname,"agents/codex/index.html"),status:resolve(import.meta.dirname,"status/index.html")}}}})
