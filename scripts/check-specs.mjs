import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

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

export const cacheRoot = () => process.env.AIRDESIGN_SPEC_CACHE ?? path.join(os.tmpdir(), "airdesign-tlc-cache")

export const specKey = (directory, spec, config) => {
  const hash = createHash("sha256")
  hash.update(spec)
  hash.update("\0")
  hash.update(config)
  for (const name of fs.readdirSync(directory).sort()) {
    if (!name.endsWith(".tla") && !name.endsWith(".cfg")) continue
    hash.update("\0")
    hash.update(name)
    hash.update("\0")
    hash.update(fs.readFileSync(path.join(directory, name)))
  }
  return hash.digest("hex")
}

const readCache = (key) => {
  const file = path.join(cacheRoot(), `${key}.json`)
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

const writeCache = (key, value) => {
  const root = cacheRoot()
  fs.mkdirSync(root, { recursive: true })
  const temporary = path.join(root, `${key}.${process.pid}.json`)
  fs.writeFileSync(temporary, JSON.stringify(value))
  fs.renameSync(temporary, path.join(root, `${key}.json`))
}

const waitForCache = (key) => {
  const deadline = Date.now() + 50000
  while (Date.now() < deadline) {
    const ready = readCache(key)
    if (ready) return ready
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
  }
  return null
}

const cachedDump = (directory, java, jar, spec, config) => {
  const key = specKey(directory, spec, config)
  const found = readCache(key)
  if (found) return { ...found, cached: true }
  if (process.env.AIRDESIGN_REPLAY_ONLY === "1") {
    const waited = waitForCache(key)
    if (waited) return waited
    throw new Error(`missing spec dump for ${spec}`)
  }
  const root = cacheRoot()
  fs.mkdirSync(root, { recursive: true })
  const lock = path.join(root, `${key}.lock`)
  let owned = false
  const deadline = Date.now() + 180000
  while (!owned && Date.now() < deadline) {
    try {
      fs.closeSync(fs.openSync(lock, "wx"))
      owned = true
    } catch (error) {
      if (error.code !== "EEXIST") throw error
      const ready = readCache(key)
      if (ready) return ready
      if (Date.now() - fs.statSync(lock).mtimeMs > 180000) fs.rmSync(lock, { force: true })
      else Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
  if (!owned) throw new Error(`timed out waiting for ${spec}`)
  try {
    const again = readCache(key)
    if (again) return again
    const dot = path.join(os.tmpdir(), `airdesign-tlc-${process.pid}-${Date.now()}.dot`)
    const result = runTlc(directory, java, jar, spec, config, ["-dump", "dot,actionlabels", dot], dot)
    const value = {
      states: distinctStates(result.output),
      passed: result.status === 0 && result.output.includes("No error has been found."),
      output: result.output,
      graph: result.graph,
    }
    writeCache(key, value)
    return value
  } finally {
    fs.rmSync(lock, { force: true })
  }
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

const runTlc = (directory, java, jar, spec, config, extra, dot) => {
  const meta = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-tlc-"))
  const modules = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-tlc-modules-"))
  const keeper = integersSnapshot(modules)
  let result
  let graph = ""
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
        ...extra,
        spec,
      ],
      { cwd: directory, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    )
    if (dot && fs.existsSync(dot)) graph = fs.readFileSync(dot, "utf8")
  } finally {
    restoreIntegers(modules)
    fs.rmSync(modules, { recursive: true, force: true })
    fs.rmSync(meta, { recursive: true, force: true })
    if (dot) fs.rmSync(dot, { force: true })
    if (keeper.exitCode === null) keeper.kill()
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  return { output, status: result?.status, graph }
}

export const checkSpec = (directory, java, jar, spec = "Edit.tla", config = "Edit.cfg") => {
  const result = cachedDump(directory, java, jar, spec, config)
  return { states: result.states, passed: result.passed, output: result.output, cached: result.cached === true }
}

const valueOf = (raw) => {
  if (raw === "TRUE") return true
  if (raw === "FALSE") return false
  if (/^-?\d+$/.test(raw)) return Number(raw)
  if (/^".*"$/.test(raw)) return raw.slice(1, -1)
  return raw
}

export const traceOf = (output) => {
  const states = []
  let current = null
  for (const line of output.split("\n")) {
    const head = /^State (\d+): (?:<(\S+)|Stuttering)/.exec(line)
    if (head) {
      current = head[2] === undefined ? null : { action: head[2] === "Initial" ? null : head[2], values: {} }
      states.push(current ?? { stutter: true })
      continue
    }
    const back = /^Back to state (\d+)/.exec(line)
    if (back) {
      states.push({ back: Number(back[1]) })
      current = null
      continue
    }
    const pair = /^\/\\ (\w+) = (.+)$/.exec(line)
    if (pair && current) current.values[pair[1]] = valueOf(pair[2])
    else if (line.trim() === "") current = null
  }
  return states
}

const told = (read, ...input) => {
  try {
    const sentence = read?.(...input)
    return typeof sentence === "string" ? sentence : null
  } catch {
    return null
  }
}

const shownValue = (value) => (typeof value === "string" ? JSON.stringify(value) : String(value))

export const readableTrace = (output, view = {}) => {
  const lines = output
    .split("\n")
    .filter((line) => line.startsWith("Error: ") && !line.includes("behavior up to this point"))
    .map((line) => line.slice("Error: ".length))
  let previous = null
  for (const [at, state] of traceOf(output).entries()) {
    if (state.back !== undefined) {
      lines.push(`  then back to step ${state.back}, and the same steps repeat forever`)
      continue
    }
    if (state.stutter) {
      lines.push("  then nothing happens forever")
      continue
    }
    const step = state.action === null ? "start" : (told(view.step, state.action, previous ?? {}) ?? state.action)
    const shown = told(view.state, state.values)
    lines.push(`  ${at + 1}. ${step} [${state.action ?? "Init"}]${shown === null ? "" : `: ${shown}`}`)
    if (previous !== null) {
      const changed = Object.keys(state.values)
        .filter((name) => JSON.stringify(state.values[name]) !== JSON.stringify(previous[name]))
        .map((name) => `${name} ${shownValue(previous[name])} -> ${shownValue(state.values[name])}`)
      if (changed.length > 0) lines.push(`     ${changed.join(", ")}`)
    }
    previous = state.values
  }
  return lines.join("\n")
}

export const chosenTopics = (list, names) => {
  if (names.length === 0) return list
  const unknown = names.filter((name) => !list.some((topic) => topic.name === name))
  if (unknown.length > 0) throw new Error(`no spec named ${unknown.join(", ")}`)
  return list.filter((topic) => names.includes(topic.name))
}

export const dumpSpec = (directory, java, jar, spec, config) => cachedDump(directory, java, jar, spec, config)

export const topics = (root) => {
  const directory = path.join(root, "specs")
  if (!fs.existsSync(directory)) return []
  const found = []
  for (const name of fs.readdirSync(directory)) {
    const topic = path.join(directory, name)
    if (!fs.statSync(topic).isDirectory()) continue
    const files = fs.readdirSync(topic)
    const spec = files.find((file) => file.endsWith(".tla"))
    if (!spec) continue
    const module = spec.slice(0, -".tla".length)
    const config = files.includes(`${module}.cfg`) ? `${module}.cfg` : undefined
    if (!config) continue
    found.push({
      name,
      topic,
      spec,
      config,
      known: files.includes(`${module}.known.cfg`) ? `${module}.known.cfg` : null,
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
    const list = chosenTopics(topics(root), process.argv.slice(2))
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
      const began = performance.now()
      const result = checkSpec(topic.topic, java, jar, topic.spec, topic.config)
      const took = result.cached ? "from the cache" : `in ${Math.round(performance.now() - began)} ms`
      if (result.states === null) {
        process.stdout.write(result.output)
        console.log(`${topic.name} did not report a state count`)
        failed = true
        continue
      }
      const tooWide = result.states >= 500
      const passed = result.passed && !tooWide
      console.log(`${topic.name} ${result.states} distinct states ${passed ? "passed" : "failed"} ${took}`)
      if (!result.passed) {
        process.stdout.write(result.output)
        const view = await import(pathToFileURL(path.join(topic.topic, "view.mjs")).href)
        console.log(`\n${topic.name} counterexample, step by step:\n${readableTrace(result.output, view)}`)
      }
      if (tooWide) console.log(`${topic.name} must stay under 500 states`)
      if (!passed) failed = true
      if (topic.known === null) continue
      const known = checkSpec(topic.topic, java, jar, topic.spec, topic.known)
      const violated = known.output.split("\n").find((line) => /^Error: .*(is violated|were violated)/.test(line))
      if (known.passed) {
        console.log(`${topic.name} ${topic.known} no longer fails. Move its invariants into ${topic.config}.`)
        failed = true
      } else if (violated === undefined) {
        process.stdout.write(known.output)
        console.log(`${topic.name} ${topic.known} did not run`)
        failed = true
      } else {
        console.log(`${topic.name} known failure in ${topic.known} still fails: ${violated.slice("Error: ".length)}`)
        if (process.argv.length > 2) {
          const view = await import(pathToFileURL(path.join(topic.topic, "view.mjs")).href)
          console.log(readableTrace(known.output, view))
        }
      }
    }
    if (failed) process.exit(1)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
