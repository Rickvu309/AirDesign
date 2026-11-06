import { DatabaseSync } from "node:sqlite"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { basics, parseTemplate, type Template } from "./index.ts"

type Principal = { personId: string }
export class TemplateStore {
  private db: DatabaseSync
  constructor(filename: string) {
    mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(filename)
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS templates(owner TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(owner,id,version)); CREATE TABLE IF NOT EXISTS template_defaults(owner TEXT PRIMARY KEY,id TEXT NOT NULL,version INTEGER NOT NULL);")
  }
  list(principal: Principal): Template[] {
    return [...structuredClone(basics), ...this.db.prepare("SELECT payload FROM templates WHERE owner=? ORDER BY id,version").all(principal.personId).map(row => parseTemplate(JSON.parse(String(row.payload))))]
  }
  get(principal: Principal, id: string, version: number): Template {
    const found = this.list(principal).find(template => template.id === id && template.version === version)
    if (!found) throw new Error("not-found")
    return found
  }
  save(principal: Principal, input: unknown): Template {
    const template = parseTemplate(input)
    if (basics.some(basic => basic.id === template.id)) throw new Error("reserved-template-id")
    const existing = this.db.prepare("SELECT payload FROM templates WHERE owner=? AND id=? AND version=?").get(principal.personId,template.id,template.version)
    if (existing) {
      if (String(existing.payload) !== JSON.stringify(template)) throw new Error("immutable-template-version")
      return template
    }
    this.db.prepare("INSERT INTO templates(owner,id,version,payload) VALUES(?,?,?,?)").run(principal.personId,template.id,template.version,JSON.stringify(template))
    return template
  }
  setDefault(principal: Principal, id: string, version: number): Template {
    const template = this.get(principal,id,version)
    if(template.fontRight==="missing")throw new Error("choose-installed-font-before-default")
    this.db.prepare("INSERT INTO template_defaults(owner,id,version) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET id=excluded.id,version=excluded.version").run(principal.personId,id,version)
    return template
  }
  default(principal: Principal): Template {
    const row = this.db.prepare("SELECT id,version FROM template_defaults WHERE owner=?").get(principal.personId)
    return row ? this.get(principal,String(row.id),Number(row.version)) : this.get(principal,"light",1)
  }
  close() { this.db.close() }
}
