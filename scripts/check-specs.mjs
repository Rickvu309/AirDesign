import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const tlaHash = "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88"

export const javaBin = () => {
  if (process.env.JAVA) return process.env.JAVA
  if (process.env.JAVA_HOME_21_X64) return path.join(process.env.JAVA_HOME_21_X64, "bin", "java")
  const local = path.join(os.homedir(), ".local", "jdk", "bin", "java")
  if (fs.existsSync(local)) return local
  throw new Error("Java 21 was not found")
}

export const jarPath = () => {
  if (process.env.TLA2TOOLS) return process.env.TLA2TOOLS
  const local = path.join(os.homedir(), ".local", "tla", "tla2tools.jar")
  if (fs.existsSync(local)) return local
  throw new Error("tla2tools.jar was not found")
}

export const assertJar = (jar) => {
  const digest = createHash("sha256").update(fs.readFileSync(jar)).digest("hex")
  if (digest !== tlaHash) throw new Error(`tla2tools.jar hash is ${digest}`)
}

const distinctStates = (output) => {
  const matches = [...output.matchAll(/(\d+) distinct states found/g)]
  if (matches.length === 0) return null
  return Number(matches[matches.length - 1][1])
}

const integersSnapshot = (modules) => {
  const extracted = path.join(modules, "Integers.tla")
  const snapshot = path.join(modules, ".Integers.tla.kept")
  return spawn(
    process.execPath,
    [
      "-e",
      [
        "const fs = require('node:fs')",
        "const extracted = process.argv[1]",
        "const snapshot = process.argv[2]",
        "const deadline = Date.now() + 180000",
        "while (Date.now() < deadline) {",
        "  if (fs.existsSync(extracted)) {",
        "    try {",
        "      fs.copyFileSync(extracted, snapshot)",
        "      const written = fs.statSync(extracted).size",
        "      if (written > 0 && written === fs.statSync(snapshot).size) break",
        "    } catch {}",
        "  }",
        "  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)",
        "}",
      ].join("\n"),
      extracted,
      snapshot,
    ],
    { stdio: "ignore" },
  )
}

const restoreIntegers = (modules) => {
  const extracted = path.join(modules, "Integers.tla")
  const snapshot = path.join(modules, ".Integers.tla.kept")
  const deadline = Date.now() + 2000
  while (!fs.existsSync(snapshot) && Date.now() < deadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20)
  }
  if (!fs.existsSync(extracted) && fs.existsSync(snapshot)) fs.copyFileSync(snapshot, extracted)
}

export const checkSpec = (directory, java, jar, spec = "Edit.tla", config = "Edit.cfg") => {
  const meta = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-tlc-"))
  const modules = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-tlc-modules-"))
  const keeper = integersSnapshot(modules)
  let result
  try {
    result = spawnSync(
      java,
      [
        "-XX:+UseParallelGC",
        `-Djava.io.tmpdir=${modules}`,
        "-cp",
        jar,
        "tlc2.TLC",
        "-workers",
        "1",
        "-config",
        config,
        "-metadir",
        meta,
        spec,
      ],
      { cwd: directory, encoding: "utf8" },
    )
  } finally {
    restoreIntegers(modules)
    fs.rmSync(modules, { recursive: true, force: true })
    fs.rmSync(meta, { recursive: true, force: true })
    if (keeper.exitCode === null) keeper.kill()
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  return {
    states: distinctStates(output),
    passed: result.status === 0 && output.includes("No error has been found."),
    output,
  }
}

export const topics = (root) => {
  const directory = path.join(root, "specs")
  if (!fs.existsSync(directory)) return []
  const found = []
  for (const name of fs.readdirSync(directory)) {
    const topic = path.join(directory, name)
    if (!fs.statSync(topic).isDirectory()) continue
    const files = fs.readdirSync(topic)
    const spec = files.find((file) => file.endsWith(".tla"))
    const config = files.find((file) => file.endsWith(".cfg"))
    if (!spec || !config) continue
    found.push({
      name,
      topic,
      spec,
      config,
      view: files.includes("view.mjs"),
    })
  }
  return found
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  try {
    const root = path.resolve(path.dirname(self), "..")
    const java = javaBin()
    const jar = jarPath()
    assertJar(jar)
    const list = topics(root)
    if (list.length === 0) {
      console.log("no specs")
      process.exit(1)
    }
    let failed = false
    for (const topic of list) {
      if (!topic.view) {
        console.log(`${topic.name} has no reader view`)
        failed = true
        continue
      }
      const result = checkSpec(topic.topic, java, jar, topic.spec, topic.config)
      if (result.states === null) {
        process.stdout.write(result.output)
        console.log(`${topic.name} did not report a state count`)
        failed = true
        continue
      }
      const tooWide = result.states >= 500
      const passed = result.passed && !tooWide
      console.log(`${topic.name} ${result.states} distinct states ${passed ? "passed" : "failed"}`)
      if (!result.passed) process.stdout.write(result.output)
      if (tooWide) console.log(`${topic.name} must stay under 500 states`)
      if (!passed) failed = true
    }
    if (failed) process.exit(1)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
