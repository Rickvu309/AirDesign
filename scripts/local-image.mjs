import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export const fontFolders = (home = os.homedir()) => [
  "/usr/share/fonts",
  "/usr/local/share/fonts",
  path.join(home, ".fonts"),
  path.join(home, ".local", "share", "fonts"),
  path.join(home, ".cache", "pptx-tools", "usr", "share", "fonts"),
]

export const fontListing = (folders) =>
  folders.flatMap((folder) => {
    try {
      return fs
        .readdirSync(folder, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const file = path.join(entry.parentPath, entry.name)
          const stat = fs.statSync(file)
          return `${file} ${stat.size} ${stat.mtimeMs}`
        })
        .sort()
    } catch {
      return []
    }
  })

const osRelease = () => {
  try {
    return fs.readFileSync("/etc/os-release", "utf8")
  } catch {
    return ""
  }
}

export const localImage = ({
  env = process.env,
  listing = fontListing(fontFolders()),
  release = osRelease(),
} = {}) => ({
  imageOs: "local",
  imageVersion: createHash("sha256")
    .update(JSON.stringify({ release, listing, locale: [env.LANG, env.LC_ALL, env.LANGUAGE, env.LC_CTYPE] }))
    .digest("hex"),
})
