import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(import.meta.dirname, "../..")

describe("malformed url", () => {
  it("returns 400 and keeps answering", async () => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "apps/server/src/main.ts"], {
      cwd: root,
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    try {
      const port = await readPort(child)
      const bad = await fetch(`http://127.0.0.1:${port}/api/people/%`)
      expect(bad.status).toBe(400)
      await expect(bad.json()).resolves.toMatchObject({ status: "bad-request" })
      expect(child.exitCode).toBeNull()
      const session = await fetch(`http://127.0.0.1:${port}/api/session`)
      expect(session.status).toBe(200)
      await expect(session.json()).resolves.toMatchObject({ status: "signed-out" })
      expect(child.exitCode).toBeNull()
    } finally {
      child.kill("SIGTERM")
      await exited(child)
    }
  }, 30_000)
})

function readPort(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    let output = ""
    const timer = setTimeout(() => reject(new Error("server-did-not-listen")), 20_000)
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString()
      const match = /listening (\d+)/.exec(output)
      if (!match?.[1]) {
        return
      }
      clearTimeout(timer)
      resolve(Number(match[1]))
    })
    child.once("exit", (code) => {
      clearTimeout(timer)
      reject(new Error(`server-exit ${code} before listen`))
    })
  })
}

function exited(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    child.once("exit", () => resolve())
  })
}
