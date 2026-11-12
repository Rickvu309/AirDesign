import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const readKeyed = (folder, key, valid) => {
  try {
    const file = path.join(folder, `${key}.json`)
    const entry = JSON.parse(fs.readFileSync(file, "utf8"))
    if (entry?.key !== key || !valid(entry.value)) return null
    const now = new Date()
    fs.utimesSync(file, now, now)
    return entry.value
  } catch {
    return null
  }
}

export const writeKeyed = (folder, key, value) => {
  fs.mkdirSync(folder, { recursive: true })
  const temporary = path.join(folder, `${key}.${process.pid}.${randomBytes(6).toString("hex")}.json`)
  fs.writeFileSync(temporary, JSON.stringify({ key, value }))
  fs.renameSync(temporary, path.join(folder, `${key}.json`))
}

export const pruneKeyed = (folder, { olderThanDays, now = Date.now() }) => {
  let removed = 0
  try {
    for (const name of fs.readdirSync(folder)) {
      if (!name.endsWith(".json")) continue
      const file = path.join(folder, name)
      if (now - fs.statSync(file).mtimeMs > olderThanDays * 86_400_000) {
        fs.rmSync(file, { force: true })
        removed += 1
      }
    }
  } catch {
    return removed
  }
  return removed
}
