import path from "node:path"
import { describe, expect, it } from "vitest"
import { browserCookies } from "./browser-cookies.mjs"
import { journeyFile, journeyName, mailsIn } from "./verify-airdesign.mjs"

const shipped = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../journeys")

describe("journey file", () => {
  it("finds a shipped journey by its name", () => {
    expect(journeyFile("deck-names")).toBe(path.join(shipped, "deck-names.mjs"))
    expect(journeyName("deck-names")).toBe("deck-names")
  })

  it("takes a scratch journey by its path and names its evidence after the file", () => {
    expect(journeyFile("/home/someone/tmp/seams.mjs")).toBe("/home/someone/tmp/seams.mjs")
    expect(journeyFile("scratch/seams.mjs")).toBe(path.resolve("scratch/seams.mjs"))
    expect(journeyName("/home/someone/tmp/seams.mjs")).toBe("seams")
  })
})

describe("sign-in cookies", () => {
  it("gives the browser the session and the account cookie the sign-in set, as production does", () => {
    expect(browserCookies(["airdesign.session=abc", "airdesign.account=d1"])).toEqual([
      expect.objectContaining({ name: "airdesign.session", value: "abc", httpOnly: true, domain: "127.0.0.1" }),
      expect.objectContaining({ name: "airdesign.account", value: "d1", httpOnly: false, domain: "127.0.0.1" }),
    ])
  })
})

describe("stack mail", () => {
  it("reads each whole mail line and leaves the line the stack is still appending", () => {
    const whole = JSON.stringify({ to: "a@example.com", text: "Your code is 123456" })
    const writing = JSON.stringify({ to: "b@example.com", text: "Your code is 654321" }).slice(0, 20)
    expect(mailsIn(`${whole}\n${writing}`)).toEqual([{ to: "a@example.com", text: "Your code is 123456" }])
    expect(mailsIn(`${whole}\n`)).toHaveLength(1)
    expect(mailsIn("")).toEqual([])
  })
})
