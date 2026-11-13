import { describe, expect, it } from "vitest"
import { signInCopy } from "./sign-in-copy"

describe("signInCopy", () => {
  it("blames the address when the address is refused and the connection only when it is not", () => {
    expect(signInCopy.emailRefused).toMatch(/email address/i)
    expect(signInCopy.emailRefused).not.toMatch(/connection/i)
    expect(signInCopy.emailFailed).toMatch(/connection/i)
  })

  it("tells a person what to do next in every refusal", () => {
    for (const line of [signInCopy.emailRefused, signInCopy.emailFailed, signInCopy.codeRefused]) {
      expect(line).toMatch(/try again|enter/i)
      expect(line).not.toMatch(/oops|sorry|invalid|your fault/i)
    }
  })
})
