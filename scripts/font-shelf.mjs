import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export const shelvedFamilies = [
  "Inter",
  "IBM Plex Sans",
  "Lato",
  "Lora",
  "Montserrat",
  "Noto Sans Arabic",
  "Noto Sans JP",
  "Playfair Display",
  "Geist",
  "Source Sans 3",
  "Source Serif 4",
]

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
  console.error(
    `a browser test asked for ${String(input)}, a font the shelf does not hold. Add its family to shelvedFamilies in scripts/font-shelf.mjs.`,
  )
  return new Response(null, { status: 404 })
}

export const shelveFonts = async (fonts) => {
  for (const family of shelvedFamilies) {
    const answer = await fonts.family(family).catch((error) => ({ ok: false, refusal: String(error) }))
    if (!answer.ok) throw new Error(`could not shelve the font ${family}: ${answer.refusal}`)
  }
}
