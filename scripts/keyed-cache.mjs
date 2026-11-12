import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const readKeyed = (folder, key, valid) => {
  try {
    const entry = JSON.parse(fs.readFileSync(path.join(folder, `${key}.json`), "utf8"))
    return entry?.key === key && valid(entry.value) ? entry.value : null
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
