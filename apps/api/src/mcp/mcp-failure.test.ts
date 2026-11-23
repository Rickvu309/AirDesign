import { createServer, request } from "node:http"
import type { AddressInfo } from "node:net"
import { limits } from "@airdesign/doom"
import type { Pool } from "pg"
import { expect, it } from "vitest"
import { FontSource } from "../platform/font-source.js"
import { serveMcp } from "./mcp.js"

const traced = (port: number) =>
  new Promise<{ status: number; text: string }>((resolve, reject) => {
    const asked = request({ host: "127.0.0.1", port, method: "TRACE", path: "/mcp" }, (answer) => {
      let text = ""
      answer.setEncoding("utf8")
      answer.on("data", (chunk: string) => (text += chunk))
      answer.on("end", () => resolve({ status: answer.statusCode ?? 0, text }))
    })
    asked.on("error", reject)
    asked.end()
  })

it("SDK failure reaches the boundary", async () => {
  const failures: unknown[] = []
  const server = createServer((req, res) => {
    void serveMcp(
      {
        deck: {} as Pool,
        email: "a@e.co",
        agentKey: "",
        session: {} as Pool,
        now: () => 0,
        mint: () => "id",
        hosts: ["127.0.0.1"],
        bodyCap: limits.body,
        fonts: new FontSource(undefined),
        fail: (error) => {
          failures.push(error)
          res.writeHead(500)
          res.end("fixed")
        },
      },
      req,
      res,
      Buffer.alloc(0),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()))
  try {
    const answer = await traced((server.address() as AddressInfo).port)
    expect(answer.status).toBe(500)
    expect(answer.text).toContain("fixed")
    expect(answer.text).not.toContain("jsonrpc")
    expect(failures).toHaveLength(1)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
