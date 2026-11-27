import { createHash } from "node:crypto"

import * as doom from "@airdesign/doom"
import { memoryDecks } from "@airdesign/agent/testing/evals"
import { guide, guides } from "@airdesign/taste"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { SKILLS_EXTENSION_ID, SkillsClient } from "@modelcontextprotocol/client/ext/skills"
import { expect, it } from "vitest"

import { createServer } from "./index.js"

function started(): doom.Doom {
  return doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ name: "Title", children: [] }] }).doom
}

async function withClient(use: (client: Client) => Promise<void>): Promise<void> {
  let minted = 0
  const server = createServer({ agent: "aira", mint: () => `minted${String((minted += 1))}` }, memoryDecks(started))
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    await use(client)
  } finally {
    await client.close()
    await server.close()
  }
}

const sha256 = (text: string) => `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`

it("negotiates the skills extension and lists every guide at its skill URI", async () => {
  await withClient(async (client) => {
    expect(client.getServerCapabilities()?.resources).toBeDefined()
    expect(client.getServerCapabilities()?.extensions?.[SKILLS_EXTENSION_ID]).toEqual({})
    const listing = await new SkillsClient(client).list()
    expect(listing.invalid).toEqual([])
    expect(listing.skills.map((skill) => skill.uri)).toEqual(
      guides()
        .map((each) => `skill://${each.name}/SKILL.md`)
        .sort(),
    )
    for (const each of guides()) {
      const entry = listing.skills.find((skill) => skill.uri === `skill://${each.name}/SKILL.md`)
      expect(entry?.frontmatter).toEqual({ name: each.name.split("/").at(-1), description: each.description })
    }
  })
})

it("gets the slides skill and reads its SKILL.md with a matching digest", async () => {
  await withClient(async (client) => {
    const { skill } = await new SkillsClient(client).get("skill://slides/SKILL.md")
    const manifest = skill.resources === "dynamic" ? undefined : skill.resources.find((file) => file.uri === skill.uri)
    expect(manifest).toBeDefined()

    const read = await client.readResource({ uri: "skill://slides/SKILL.md" })
    const text = (read.contents[0] as { readonly text: string }).text
    expect(sha256(text)).toBe(manifest?.digest)
    expect(Buffer.byteLength(text, "utf8")).toBe(manifest?.size)

    const verified = await new SkillsClient(client).read(skill)
    expect(verified.verified).toBe(true)
    expect(verified.body?.trim()).toBe(guide("slides")?.markdown)
  })
})

it("serves every file of every skill so a host can verify it", async () => {
  await withClient(async (client) => {
    const skillsClient = new SkillsClient(client)
    const { skills: listed } = await skillsClient.list()
    expect(listed.length).toBeGreaterThan(0)
    for (const skill of listed) {
      if (skill.resources === "dynamic") throw new Error(`${skill.uri} is dynamic`)
      for (const file of skill.resources) {
        expect((await skillsClient.read(skill, file.uri)).verified).toBe(true)
      }
    }
  })
})

it("answers a skill URI it does not serve as invalid params", async () => {
  await withClient(async (client) => {
    await expect(new SkillsClient(client).get("skill://missing/SKILL.md")).rejects.toThrow(/No skill is served/)
  })
})
