import { Socket } from "node:net"
import { readFile, writeFile } from "node:fs/promises"
import { fileLimits } from "../../../../packages/files/src/index.ts"
const input = await readFile("/job/input.pptx")
if (input.length > fileLimits.compressed) throw new Error("upload-limit")
const mode = input.subarray(4).toString()
const report: Record<string, unknown> = { probe: mode, limits: await readFile("/proc/self/limits", "utf8") }
if (mode === "network") {
  const destinations = ["127.0.0.1", "169.254.169.254", "10.0.0.1", "1.1.1.1"]
  report.network = await Promise.all(destinations.map(host => new Promise(resolve => {
    const socket = new Socket()
    const finish = (result: string) => { socket.destroy(); resolve({ host, result }) }
    socket.once("error", error => finish(error.message))
    socket.setTimeout(500, () => finish("timeout"))
    socket.connect(80, host, () => finish("connected"))
  })))
}
if (mode === "oom") {
  const retained: Buffer[] = []
  for (;;) retained.push(Buffer.alloc(16 * 1024 * 1024, 1))
}
if (mode === "hang") await new Promise(resolve => setTimeout(resolve, 120_000))
await writeFile("/job/result.pptx", input)
await writeFile("/job/report.json", JSON.stringify(report))
