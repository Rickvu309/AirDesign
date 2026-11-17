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
