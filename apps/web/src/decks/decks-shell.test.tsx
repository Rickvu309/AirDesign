import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DecksShell } from "./decks-shell"

const shell = (email: string) =>
  renderToStaticMarkup(
    <DecksShell active="recents" account={{ email }} onSignOut={() => {}}>
      <p>content</p>
    </DecksShell>,
  )

describe("account row", () => {
  it("names the account by its email once it is known", () => {
    const html = shell("person@example.com")
    expect(html).toContain(">person@example.com</span>")
    expect(html).toContain(">P</span>")
  })

  it("says Account with its own initial while the email is not known, never a blank circle", () => {
    const html = shell("")
    expect(html).toContain(">Account</span>")
    expect(html).toContain(">A</span>")
  })
})
