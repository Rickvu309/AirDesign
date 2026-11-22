import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { migrationFile, numberedMigrations } from "./numbered-migrations.js"

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

const folderWith = (files: Record<string, string>): URL => {
  const folder = path.join(mkdtempSync(path.join(tmpdir(), "migrations-")), "migrations")
  folders.push(path.dirname(folder))
  mkdirSync(folder)
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(folder, name), text)
  return pathToFileURL(`${folder}/`)
}

describe("numberedMigrations", () => {
  it("takes each file's number as its id and its sql export as its sql, in number order", () => {
    const folder = folderWith({
      "0026-add-index.js": 'export const sql = "create index i on t (a);"\n',
      "0025-add-table.ts": 'export const sql: string = "create table t (a int);"\n',
      "0027-add-table.d.ts": "export declare const sql: string\n",
      "notes.md": "not a migration\n",
    })
    expect(numberedMigrations(folder)).toEqual([
      { id: 25, sql: "create table t (a int);" },
      { id: 26, sql: "create index i on t (a);" },
    ])
  })

  it("has none when the folder does not exist yet", () => {
    expect(numberedMigrations(new URL("file:///nowhere/migrations/"))).toEqual([])
  })

  it("refuses a file that does not export its sql", () => {
    const folder = folderWith({ "0025-empty.ts": "export const query = 1\n" })
    expect(() => numberedMigrations(folder)).toThrow("0025-empty.ts must export its sql as a string named sql")
  })

  it("names every file in the real folder the way the loader reads it", () => {
    const real = new URL("./migrations/", import.meta.url)
    let names: string[] = []
    try {
      names = readdirSync(real)
    } catch {
      names = []
    }
    expect(names.filter((name) => !name.endsWith(".test.ts") && !migrationFile.test(name))).toEqual([])
  })
})
