import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export const shelvedFamilies = ["Inter", "IBM Plex Sans", "Lato", "Lora", "Montserrat", "Playfair Display"]

export const shelfFolder = join(homedir(), ".cache/airdesign/fonts")

export const fontShelf = (folder) => ({
  read: async (key) => {
    try {
      return await readFile(join(folder, key))
    } catch (error) {
      if (error.code === "ENOENT") return undefined
      throw error
    }
  },
  write: async (key, bytes) => {
    const file = join(folder, key)
    await mkdir(dirname(file), { recursive: true })
    const partial = `${file}.${String(process.pid)}.partial`
    await writeFile(partial, bytes)
    await rename(partial, file)
  },
})

export const offShelf = async (input) => {
  const said = `a browser test asked for ${String(input)}, a font the shelf does not hold. Add its family to shelvedFamilies in tests/browser/font-shelf.mjs.`
  console.error(said)
  throw new Error(said)
}

export const shelveFonts = async (fonts) => {
  for (const family of shelvedFamilies) {
    const answer = await fonts.family(family).catch((error) => ({ ok: false, refusal: String(error) }))
    if (!answer.ok) throw new Error(`could not shelve the font ${family} for the browser tests: ${answer.refusal}`)
  }
}
