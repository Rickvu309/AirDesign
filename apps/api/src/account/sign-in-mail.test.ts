import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { signInMinutes } from "./account.js"
import { mailDark, mailLight, mailRadius, type MailColors } from "./sign-in-mail-art.js"
import { readSignInMail, signInMail } from "./sign-in-mail.js"

const link = "https://app.example/sign-in/link?token=Ab-c_9&x=<y>"
const code = "048213"
const built = signInMail({ link, code, minutes: signInMinutes })

const tokens = new Map(
  [
    ...readFileSync(new URL("../../../../packages/theme/src/tokens.css", import.meta.url), "utf8").matchAll(
      /--([a-z0-9-]+):\s*([^;]+);/g,
    ),
  ].map((found) => [found[1] ?? "", (found[2] ?? "").trim()]),
)

const lightRoles: Record<keyof MailColors, string> = {
  page: "canvas",
  card: "background",
  edge: "border",
  text: "foreground",
  quiet: "muted-foreground",
  codeFill: "muted",
  codeEdge: "field-edge",
  button: "primary-strong",
  buttonText: "primary-foreground",
  link: "primary-strong",
}

const darkRoles: Record<keyof MailColors, string> = {
  page: "ink",
  card: "foreground",
  edge: "quiet",
  text: "canvas",
  quiet: "faint",
  codeFill: "ink",
  codeEdge: "quiet",
  button: "primary-strong",
  buttonText: "primary-foreground",
  link: "primary-top",
}

const voidTags = new Set(["meta", "br", "img", "hr", "link", "input"])

function openTags(html: string): string[] {
  const open: string[] = []
  for (const found of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g)) {
    const name = (found[2] ?? "").toLowerCase()
    if (voidTags.has(name)) continue
    if (found[1] === "/") {
      if (open.pop() !== name) throw new Error(`closes ${name} out of order`)
    } else {
      open.push(name)
    }
  }
  return open
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

describe("the sign-in mail", () => {
  it("says what it is in the subject and keeps the code and link out of it", () => {
    expect(built.subject).toBe("Sign in to AirDesign")
    expect(built.subject).not.toContain(code)
    expect(built.subject).not.toContain("token")
  })

  it("writes the plain text with the code and the link each alone on one line", () => {
    expect(built.text).toBe(
      [
        "Your AirDesign sign-in code:",
        "",
        code,
        "",
        "Enter this code where you asked to sign in, or open this link:",
        "",
        link,
        "",
        `The code and link work once and expire in ${String(signInMinutes)} minutes.`,
        "",
        "If you didn't ask to sign in, ignore this email. No one can sign in without this code or link.",
        "",
      ].join("\n"),
    )
    expect(count(built.text, code)).toBe(1)
    expect(count(built.text, link)).toBe(1)
  })

  it("reads the code and the link back out of the plain text", () => {
    expect(readSignInMail(built.text)).toEqual({ link, code })
  })

  it("refuses text that is not one sign-in mail", () => {
    expect(() => readSignInMail("hello")).toThrow()
    expect(() => readSignInMail(`${built.text}\n123456`)).toThrow()
  })

  it("takes the minutes from what the API enforces, as whole sentences", () => {
    const one = signInMail({ link, code, minutes: 1 })
    expect(one.text).toContain("The code and link work once and expire in 1 minute.")
    expect(one.html).toContain("Use the code or link inside. Both expire in 1 minute.")
    const many = signInMail({ link, code, minutes: 30 })
    expect(many.text).toContain("expire in 30 minutes.")
    expect(built.html).toContain(`Use the code or link inside. Both expire in ${String(signInMinutes)} minutes.`)
  })

  it("writes balanced HTML with a language, both color schemes and layout tables", () => {
    expect(built.html.startsWith("<!doctype html>")).toBe(true)
    expect(openTags(built.html)).toEqual([])
    expect(built.html).toContain('<html lang="en" dir="ltr">')
    expect(built.html).toContain('<meta name="color-scheme" content="light dark">')
    expect(built.html).toContain('<meta name="supported-color-schemes" content="light dark">')
    const tables = [...built.html.matchAll(/<table\b[^>]*>/g)].map((found) => found[0])
    expect(tables.length).toBeGreaterThan(0)
    for (const table of tables) expect(table).toContain('role="presentation"')
  })

  it("shows the code as one selectable string that a screen reader reads digit by digit", () => {
    expect(built.html).toContain(`aria-label="Sign-in code: 0 4 8 2 1 3">${code}</div>`)
    expect(count(built.html, code)).toBe(1)
  })

  it("puts the link only in the button, the fallback href and the fallback text, escaped", () => {
    const escapedLink = "https://app.example/sign-in/link?token=Ab-c_9&amp;x=&lt;y&gt;"
    expect(built.html).not.toContain(link)
    expect(built.html).not.toContain("<y>")
    expect(count(built.html, escapedLink)).toBe(3)
    expect(count(built.html, `href="${escapedLink}"`)).toBe(2)
    expect(built.html).toContain(">Sign in to AirDesign</a>")
  })

  it("loads nothing from anywhere", () => {
    expect(built.html).not.toContain("http:")
    expect(built.html).not.toMatch(/<img\b/i)
    expect(built.html).not.toMatch(/url\(/i)
    expect(built.html).not.toMatch(/<link\b/i)
    expect(built.html).not.toMatch(/@import/i)
    const hosts = [...built.html.matchAll(/https:\/\/[^"<\s]+/g)].map(
      (found) => new URL(found[0].replaceAll("&amp;", "&")).host,
    )
    expect(new Set(hosts)).toEqual(new Set(["app.example"]))
  })

  it("escapes every value it is given", () => {
    const hostile = signInMail({ link: 'https://app.example/?a="><script>', code: "<b>1", minutes: signInMinutes })
    expect(hostile.html).not.toContain("<script>")
    expect(hostile.html).not.toContain("<b>1")
    expect(hostile.html).not.toContain('"><')
  })

  it("keeps its colors and corners on the theme tokens", () => {
    for (const [role, token] of Object.entries(lightRoles))
      expect(mailLight[role as keyof MailColors], role).toBe(tokens.get(token))
    for (const [role, token] of Object.entries(darkRoles))
      expect(mailDark[role as keyof MailColors], role).toBe(tokens.get(token))
    const radius = Number.parseFloat(tokens.get("radius") ?? "") * 16
    expect(mailRadius.button).toBe(radius)
    expect(mailRadius.code).toBe(Math.round(radius * 1.4))
    expect(mailRadius.card).toBe(Math.round(radius * 1.8))
  })
})
