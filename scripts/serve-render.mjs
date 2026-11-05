import { preview } from "vite"
const server = await preview({ root: "apps/studio", configFile: false, preview: { host: "127.0.0.1", port: Number(process.env.RENDER_PORT ?? 41732), strictPort: true } })
process.stdout.write(`Render fixture: ${server.resolvedUrls.local[0]}render-fixture\n`)
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { server.httpServer.close(); process.exit(0) })
