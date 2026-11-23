import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const workspaceFolders = ["apps", "packages"]

const manifestOf = (folder) => JSON.parse(fs.readFileSync(path.join(folder, "package.json"), "utf8"))

export const packageFolder = (repo, name) => {
  for (const top of workspaceFolders.filter((each) => fs.existsSync(path.join(repo, each)))) {
    for (const each of fs.readdirSync(path.join(repo, top))) {
      const folder = path.join(repo, top, each)
      if (fs.existsSync(path.join(folder, "package.json")) && manifestOf(folder).name === name) return folder
    }
  }
  throw new Error(`No package in ${workspaceFolders.join(" or ")} is named ${name}.`)
}

export const packageEntry = (repo, name) => {
  const folder = packageFolder(repo, name)
  const entry = manifestOf(folder).exports?.["."]?.import
  if (entry === undefined) throw new Error(`${name} exports no "." import in its package.json.`)
  return path.join(folder, entry)
}

export const packageBuild = async (repo, name, file) => {
  const index = packageEntry(repo, name)
  const entry = file === undefined ? index : path.join(path.dirname(index), file)
  if (!fs.existsSync(entry)) throw new Error(`${name} is not built. Run pnpm build, then run this again.`)
  return import(pathToFileURL(entry).href)
}
