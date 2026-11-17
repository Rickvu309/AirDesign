import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { assetName, githubRepository, imageLink, proofFolder, publish } from "./publish.mjs"

const folder = mkdtempSync(path.join(os.tmpdir(), "publish-"))
afterAll(() => rmSync(folder, { recursive: true, force: true }))

function shots(name, files) {
  const dir = path.join(folder, `${name}-shots`)
  mkdirSync(dir, { recursive: true })
  return files.map((file) => {
    writeFileSync(path.join(dir, file), `${name} ${file}`)
    return path.join(dir, file)
  })
}

function releases(initial) {
  const assets = new Map(Object.entries(initial))
  const commands = []
  const runGh = (args) => {
    commands.push(args)
    const [, command, tag] = args
    if (command === "view") {
      if (!assets.has(tag)) throw new Error("release not found")
      return { assets: assets.get(tag).map((name) => ({ name })) }
    }
    if (command === "create") assets.set(tag, [])
    if (command === "upload") {
      const current = assets.get(tag)
      if (current.length + args.length - 3 > 1000) {
        throw new Error("HTTP 422: file_count limited to 1000 assets per release")
      }
      current.push(...args.slice(3).map((file) => path.basename(file)))
    }
    return ""
  }
  return { assets, commands, runGh }
}

const full = (count = 1000) => Array.from({ length: count }, (_, index) => `old-${index}.png`)

describe("publish", () => {
  it("names assets by pull request, base name, and content hash", () => {
    const bytesA = Buffer.from("content-alpha")
    const bytesB = Buffer.from("content-beta")
    const nameA1 = assetName({ prefix: "pr-10", file: "shot.png", bytes: bytesA })
    const nameA2 = assetName({ prefix: "pr-10", file: "shot.png", bytes: bytesA })
    expect(nameA1).toBe(nameA2)

    const nameB = assetName({ prefix: "pr-10", file: "shot.png", bytes: bytesB })
    expect(nameA1).not.toBe(nameB)

    const nameOtherPr = assetName({ prefix: "pr-11", file: "shot.png", bytes: bytesA })
    expect(nameA1).not.toBe(nameOtherPr)
  })

  it("links assets to the proof release download url", () => {
    expect(githubRepository(() => JSON.stringify({ nameWithOwner: "Rickvu309/AirDesign" }))).toBe("Rickvu309/AirDesign")
    expect(imageLink("Rickvu309/AirDesign", "pr-1-shot-1234567890.png")).toBe(
      "https://github.com/Rickvu309/AirDesign/releases/download/proof/pr-1-shot-1234567890.png",
    )
  })

  it("uploads missing assets to the proof release and skips existing assets", () => {
    const commands = []
    const assets = ["pr-1-already-1111111111.png"]
    const mockGh = (args) => {
      commands.push(args)
      if (args[0] === "release" && args[1] === "view") {
        return JSON.stringify({ assets: assets.map((name) => ({ name })) })
      }
      if (args[0] === "release" && args[1] === "upload") {
        for (const file of args.slice(3)) {
          assets.push(path.basename(file))
        }
        return ""
      }
      return ""
    }

    const files = shots("first", ["new.png"])
    const res = publish({
      files,
      prefix: "pr-1",
      scratch: folder,
      repository: "Rickvu309/AirDesign",
      runGh: mockGh,
    })
    expect(commands.some((cmd) => cmd[0] === "release" && cmd[1] === "upload")).toBe(true)
    expect(Object.keys(res.links)).toEqual(["new.png"])
    expect(res.links["new.png"]).toContain("/releases/download/proof/pr-1-new-")

    commands.length = 0
    const secondRes = publish({
      files,
      prefix: "pr-1",
      scratch: folder,
      repository: "Rickvu309/AirDesign",
      runGh: mockGh,
    })
    expect(commands.some((cmd) => cmd[0] === "release" && cmd[1] === "upload")).toBe(false)
    expect(secondRes.links["new.png"]).toBe(res.links["new.png"])
  })

  it("creates a prerelease when the proof release does not exist", () => {
    const commands = []
    let created = false
    const mockGh = (args) => {
      commands.push(args)
      if (args[0] === "release" && args[1] === "view") {
        if (!created) {
          const err = new Error("release not found")
          err.stderr = "release not found"
          throw err
        }
        return JSON.stringify({ assets: [] })
      }
      if (args[0] === "release" && args[1] === "create") {
        created = true
        return ""
      }
      if (args[0] === "release" && args[1] === "upload") return ""
      return ""
    }

    const files = shots("create", ["shot.png"])
    publish({
      files,
      prefix: "pr-2",
      scratch: folder,
      repository: "Rickvu309/AirDesign",
      runGh: mockGh,
    })
    expect(
      commands.some(
        (cmd) =>
          cmd[0] === "release" &&
          cmd[1] === "create" &&
          cmd.includes("proof") &&
          cmd.includes("--prerelease") &&
          cmd.includes("Proof images"),
      ),
    ).toBe(true)
  })

  it.each([true, false])("rolls a full proof into proof-2, existing: %s", (exists) => {
    const fake = releases({ proof: full(), ...(exists ? { "proof-2": [] } : {}) })
    const files = shots(`rollover-${String(exists)}`, ["a.png", "b.png"])
    const options = { files, prefix: "pr-673", scratch: folder, repository: "Rickvu309/AirDesign", runGh: fake.runGh }
    const result = publish(options)
    expect(result.release).toBe("proof-2")
    expect(Object.values(result.links).every((link) => link.includes("/download/proof-2/"))).toBe(true)
    expect(fake.assets.get("proof")).toHaveLength(1000)
    expect(fake.assets.get("proof-2")).toHaveLength(2)
    expect(fake.commands.filter((args) => args[1] === "create")).toEqual(
      exists
        ? []
        : [
            [
              "release",
              "create",
              "proof-2",
              "--prerelease",
              "--title",
              "Proof images",
              "--notes",
              "Screenshots attached to pull requests. Not a product release.",
            ],
          ],
    )
    fake.commands.length = 0
    expect(publish(options)).toEqual(result)
    expect(fake.commands.every((args) => args[1] === "view")).toBe(true)
  })

  it("keeps a batch together through multiple full releases", () => {
    const fake = releases({ proof: full(999), "proof-2": full(), "proof-3": full(998) })
    const result = publish({
      files: shots("batch", ["a.png", "b.png"]),
      prefix: "pr-1",
      scratch: folder,
      repository: "repo",
      runGh: fake.runGh,
    })
    expect(result.release).toBe("proof-3")
    expect(fake.assets.get("proof")).toHaveLength(999)
    expect(fake.assets.get("proof-3")).toHaveLength(1000)
    expect(fake.commands.filter((args) => args[1] === "upload")).toHaveLength(1)
  })

  it("counts existing file names as no-ops even at capacity", () => {
    const files = shots("capacity", ["a.png", "b.png"])
    const present = assetName({ prefix: "pr-1", file: files[0], bytes: Buffer.from("capacity a.png") })
    const fake = releases({ proof: [...full(998), present] })
    const options = { files, prefix: "pr-1", scratch: folder, repository: "repo", runGh: fake.runGh }
    expect(publish(options).release).toBe("proof")
    expect(fake.assets.get("proof")).toHaveLength(1000)
    fake.commands.length = 0
    expect(publish(options).release).toBe("proof")
    expect(fake.commands.every((args) => args[1] === "view")).toBe(true)
  })

  it("refuses a batch larger than a release before calling GitHub", () => {
    expect(() =>
      publish({
        files: Array.from({ length: 1001 }, (_, index) => `${index}.png`),
        prefix: "pr-1",
        runGh: () => {
          throw new Error("unexpected GitHub call")
        },
      }),
    ).toThrow("1000")
  })

  it("puts other kinds of file in a release that names them, keeping each extension", () => {
    const commands = []
    const runGh = (args) => {
      commands.push(args)
      if (args[0] === "release" && args[1] === "view")
        throw Object.assign(new Error("x"), { stderr: "release not found" })
      return ""
    }
    const files = shots("refs", ["deck.pptx", "deck.pdf"])
    const res = publish({
      files,
      prefix: "fidelity",
      scratch: folder,
      release: "fidelity-refs",
      kinds: [".pptx", ".pdf"],
      about: { title: "Fidelity references", notes: "PowerPoint's own pictures of slides." },
      repository: "Rickvu309/AirDesign",
      runGh,
    })
    expect(res.placed["deck.pptx"]).toMatch(/^fidelity-deck-[0-9a-f]{10}\.pptx$/)
    expect(res.placed["deck.pdf"]).toMatch(/^fidelity-deck-[0-9a-f]{10}\.pdf$/)
    expect(commands.find((cmd) => cmd[1] === "create")).toContain("Fidelity references")
    expect(() =>
      publish({
        files: shots("refs-png", ["shot.png"]),
        prefix: "f",
        scratch: folder,
        release: "fidelity-refs",
        kinds: [".pdf"],
        repository: "repo",
        runGh,
      }),
    ).toThrow("shot.png is not one of .pdf")
  })

  it("puts a bench summary on the bench release under its own name and extension", () => {
    const commands = []
    const summary = path.join(folder, "2c036f24-claude-sonnet-5-5-low-2026-11-16.json")
    writeFileSync(summary, "{}")
    const placed = publish({
      files: [summary],
      prefix: "agent-bench",
      release: "bench",
      kinds: [".json"],
      about: { title: "bench results", notes: "Results measured by hand. Not a product release." },
      scratch: folder,
      repository: "Rickvu309/AirDesign",
      runGh: (args) => {
        commands.push(args)
        if (args[1] === "view") throw Object.assign(new Error("release not found"), { stderr: "release not found" })
        return ""
      },
    })
    const asset = placed.placed[path.basename(summary)]
    expect(asset).toMatch(/^agent-bench-2c036f24-claude-sonnet-5-5-low-2026-11-16-[0-9a-f]{10}\.json$/)
    expect(placed.links[path.basename(summary)]).toContain("/releases/download/bench/agent-bench-")
    const created = commands.find((args) => args[1] === "create")
    expect(created).toContain("bench")
    expect(created).not.toContain("Proof images")
  })

  it("refuses files that are not PNG and two files with one name", () => {
    expect(() =>
      publish({
        files: [path.join(folder, "notes.md")],
        prefix: "pr-1",
        scratch: folder,
        repository: "repo",
        runGh: () => "{}",
      }),
    ).toThrow("is not a PNG")
    expect(() =>
      publish({
        files: ["/a/shot.png", "/b/shot.png"],
        prefix: "pr-1",
        scratch: folder,
        repository: "repo",
        runGh: () => "{}",
      }),
    ).toThrow("two files are named shot.png")
  })

  it("names the folder by pull request or branch", () => {
    expect(proofFolder({ pr: 342 })).toBe("pr-342")
    expect(proofFolder({ branch: "t3/before after" })).toBe("branch-t3-before-after")
    expect(() => proofFolder({ pr: "abc" })).toThrow("--pr takes a pull request number")
    expect(() => proofFolder({ branch: "" })).toThrow("name the pull request with --pr")
  })
})
