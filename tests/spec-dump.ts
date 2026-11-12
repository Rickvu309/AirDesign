import { spawn } from "node:child_process"

export function dumpTopics(
  found: readonly { name: string; topic: string; spec: string; config: string }[],
): Promise<readonly { name: string; graph: string; output: string }[]> {
  const specifier = new URL("../scripts/check-specs.mjs", import.meta.url).href
  return Promise.all(
    found.map(
      (topic) =>
        new Promise<{ name: string; graph: string; output: string }>((resolve, reject) => {
          const child = spawn(process.execPath, ["--input-type=module"], { stdio: ["pipe", "pipe", "pipe"] })
          let out = ""
          let err = ""
          child.stdout.setEncoding("utf8")
          child.stderr.setEncoding("utf8")
          child.stdout.on("data", (chunk: string) => {
            out += chunk
          })
          child.stderr.on("data", (chunk: string) => {
            err += chunk
          })
          child.on("error", reject)
          child.on("close", (code) => {
            if (code !== 0) {
              reject(new Error(`${topic.name} ${err || out}`))
              return
            }
            const parsed = JSON.parse(out) as { graph: string; output: string }
            resolve({ name: topic.name, graph: parsed.graph, output: parsed.output })
          })
          child.stdin.end(
            `import { dumpSpec, javaBin, jarPath } from ${JSON.stringify(specifier)}\nconst dumped = dumpSpec(${JSON.stringify(topic.topic)}, javaBin(), jarPath(), ${JSON.stringify(topic.spec)}, ${JSON.stringify(topic.config)})\nprocess.stdout.write(JSON.stringify({ graph: dumped.graph, output: dumped.output }))\n`,
          )
        }),
    ),
  )
}
